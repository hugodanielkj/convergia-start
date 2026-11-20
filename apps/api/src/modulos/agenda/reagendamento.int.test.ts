import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarBarramentoEmMemoria } from '../../base/eventos.js';
import { criarPrisma } from '../../base/prisma.js';
import { carregarContexto, slotsLivres } from './slots-publicos.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../testes/dependencias.js';
import { liberarAteReuniao } from '../../testes/liberacao.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const apps: FastifyInstance[] = [];
const sufixo = randomUUID().slice(0, 8);
const HORA = 60 * 60 * 1000;
// AGORA_TESTE é segunda 16/11/2026 09:00 em São Paulo (12:00 UTC); os slots começam na terça 12:00 UTC.
const dia = (n: number, hora: number) => `2026-11-${String(n)}T${String(hora)}:00:00.000Z`;

let agenciaA: string;
let agenciaB: string;
let adminA: string;
let responsavelA: string;
let outroMembro: string;
let appAdmin: FastifyInstance;
let appResponsavel: FastifyInstance;
let appOutroMembro: FastifyInstance;
let appAdminB: FastifyInstance;
let appPublico: FastifyInstance;
const eventos: { tipo: string; dados: Record<string, unknown> }[] = [];

function construir(usuario: UsuarioAutenticado | null, agora = AGORA_TESTE): FastifyInstance {
  const barramento = criarBarramentoEmMemoria((erro) => {
    throw erro;
  });
  for (const tipo of [
    'agendamento.reagendado',
    'agendamento.cancelado',
    'agendamento.realizado',
    'agendamento.nao_compareceu',
  ] as const) {
    barramento.assinar(tipo, (e) => {
      eventos.push({ tipo: e.tipo, dados: { ...e.dados } });
      return Promise.resolve();
    });
  }
  const app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      eventos: barramento,
      relogio: relogioFixo(agora),
      resolverSessao: () => Promise.resolve(usuario),
    }),
  );
  apps.push(app);
  return app;
}

async function criarAgencia(nome: string) {
  const id = (await prisma.agencia.create({ data: { nome } })).id;
  await prisma.configAgencia.create({ data: { agenciaId: id, ...CONFIG_PADRAO } });
  const usuario = (papel: 'admin' | 'membro', apelido: string) =>
    prisma.usuario.create({
      data: { agenciaId: id, nome: apelido, email: `${apelido}-${nome}-${sufixo}@ag.com`, papel },
    });
  return { id, usuario };
}

beforeAll(async () => {
  const a = await criarAgencia('A');
  const b = await criarAgencia('B');
  agenciaA = a.id;
  agenciaB = b.id;
  adminA = (await a.usuario('admin', 'admin')).id;
  responsavelA = (await a.usuario('membro', 'responsavel')).id;
  outroMembro = (await a.usuario('membro', 'outro')).id;
  const adminB = (await b.usuario('admin', 'admin')).id;
  appAdmin = construir(usuarioTeste({ agenciaId: agenciaA, id: adminA }));
  appResponsavel = construir(
    usuarioTeste({ agenciaId: agenciaA, id: responsavelA, papel: 'membro' }),
  );
  appOutroMembro = construir(
    usuarioTeste({ agenciaId: agenciaA, id: outroMembro, papel: 'membro' }),
  );
  appAdminB = construir(usuarioTeste({ agenciaId: agenciaB, id: adminB }));
  appPublico = construir(null);
  await Promise.all(apps.map((app) => app.ready()));
  for (const app of [appAdmin, appAdminB]) {
    for (const diaSemana of [1, 2, 3, 4, 5]) {
      await app.inject({
        method: 'POST',
        url: '/agenda/disponibilidades',
        payload: { tipo: 'reuniao', diaSemana, horaInicio: '09:00', horaFim: '12:00' },
      });
    }
  }
});

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaA, agenciaB] } } });
  await prisma.$disconnect();
});

let contador = 0;
async function novoCliente(app = appAdmin, extra: Record<string, unknown> = {}) {
  contador += 1;
  const resposta = await app.inject({
    method: 'POST',
    url: '/clientes',
    payload: {
      nomeEmpresa: `Cliente ${String(contador)}`,
      nomeContato: 'Contato',
      email: `c${String(contador)}-${sufixo}@teste.com`,
      ...extra,
    },
  });
  const corpo = resposta.json<{
    cliente: { onboarding: { id: string } };
    link: { token: string };
  }>();
  await liberarAteReuniao(prisma, corpo.link.token);
  return { token: corpo.link.token, onboardingId: corpo.cliente.onboarding.id };
}

async function agendado(inicio: string, extra: Record<string, unknown> = {}, app = appAdmin) {
  const cliente = await novoCliente(app, extra);
  const resposta = await appPublico.inject({
    method: 'POST',
    url: `/publico/onboardings/${cliente.token}/agendamentos`,
    payload: { tipo: 'reuniao', inicio },
  });
  expect(resposta.statusCode).toBe(201);
  return { ...cliente, id: resposta.json<{ agendamento: { id: string } }>().agendamento.id };
}

const reagendar = (token: string, id: string, inicio: string, app = appPublico) =>
  app.inject({
    method: 'POST',
    url: `/publico/onboardings/${token}/agendamentos/${id}/reagendar`,
    payload: { inicio },
  });
const acao = (
  app: FastifyInstance,
  id: string,
  nome: 'cancelar' | 'realizado' | 'nao-compareceu',
  corpo: Record<string, unknown> = {},
) => app.inject({ method: 'POST', url: `/agendamentos/${id}/${nome}`, payload: corpo });
const slotsDoDia = async (token: string, data: string) =>
  (
    await appPublico.inject({
      method: 'GET',
      url: `/publico/onboardings/${token}/slots?tipo=reuniao&de=${data}&ate=${data}`,
    })
  )
    .json<{ dias: { slots: { inicio: string }[] }[] }>()
    .dias.flatMap((d) => d.slots.map((s) => s.inicio));

describe('RN-35 e RN-36 o cliente reagenda o próprio horário', () => {
  it('lista os agendamentos com quantos reagendamentos ainda restam', async () => {
    const { token, id } = await agendado(dia(17, 12));
    const resposta = await appPublico.inject({
      method: 'GET',
      url: `/publico/onboardings/${token}/agendamentos`,
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['cache-control']).toBe('no-store');
    expect(resposta.json()).toEqual({
      agendamentos: [
        {
          id,
          tipo: 'reuniao',
          inicio: dia(17, 12),
          fim: dia(17, 13),
          status: 'agendado',
          reagendamentosRestantes: 2,
          podeReagendar: true,
          pedidoEnviado: false,
        },
      ],
    });
  });

  it('troca o horário no mesmo registro, libera o antigo e audita', async () => {
    const { token, id, onboardingId } = await agendado(dia(18, 12));
    const resposta = await reagendar(token, id, dia(18, 13));
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      agendamento: {
        id,
        tipo: 'reuniao',
        inicio: dia(18, 13),
        fim: dia(18, 14),
        status: 'reagendado',
        reagendamentosRestantes: 1,
      },
    });

    expect(await prisma.agendamento.count({ where: { onboardingId } })).toBe(1);
    expect(await prisma.agendamento.findUniqueOrThrow({ where: { id } })).toMatchObject({
      reagendamentos: 1,
      status: 'reagendado',
    });
    const outro = await novoCliente();
    expect(await slotsDoDia(outro.token, '2026-11-18')).toContain(dia(18, 12));
    expect(await slotsDoDia(outro.token, '2026-11-18')).not.toContain(dia(18, 13));

    expect(
      await prisma.auditoriaLog.count({
        where: { entidadeId: id, acao: 'agendamento.reagendado' },
      }),
    ).toBe(1);
    expect(eventos).toContainEqual({
      tipo: 'agendamento.reagendado',
      dados: expect.objectContaining({
        agendamentoId: id,
        inicioAnterior: dia(18, 12),
        inicio: dia(18, 13),
      }) as Record<string, unknown>,
    });
  });

  it('depois do limite o cliente é mandado falar com a agência', async () => {
    const { token, id } = await agendado(dia(19, 12));
    expect((await reagendar(token, id, dia(19, 13))).statusCode).toBe(200);
    expect((await reagendar(token, id, dia(19, 14))).statusCode).toBe(200);
    const terceira = await reagendar(token, id, dia(19, 12));
    expect(terceira.statusCode).toBe(422);
    expect(terceira.json()).toMatchObject({
      erro: 'REAGENDAMENTO_NEGADO',
      motivo: 'limite_atingido',
      mensagem: expect.stringMatching(/agência/) as string,
    });
    expect(await prisma.agendamento.findUniqueOrThrow({ where: { id } })).toMatchObject({
      reagendamentos: 2,
      inicio: new Date(dia(19, 14)),
    });

    const lista = await appPublico.inject({
      method: 'GET',
      url: `/publico/onboardings/${token}/agendamentos`,
    });
    expect(lista.json<{ agendamentos: unknown[] }>().agendamentos[0]).toMatchObject({
      reagendamentosRestantes: 0,
      podeReagendar: false,
    });
  });

  it('recusa quando falta menos que a antecedência para o horário atual', async () => {
    const { token, id } = await agendado(dia(23, 12)); // segunda 23/11
    const maisTarde = construir(null, new Date(new Date(dia(23, 12)).getTime() - 12 * HORA));
    await maisTarde.ready();
    const resposta = await reagendar(token, id, dia(24, 12), maisTarde);
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json()).toMatchObject({
      erro: 'REAGENDAMENTO_NEGADO',
      motivo: 'prazo_encerrado',
    });
  });

  it('horário já ocupado devolve 409 com a lista atualizada e não mexe no agendamento', async () => {
    await agendado(dia(24, 13));
    const { token, id } = await agendado(dia(24, 12));
    const resposta = await reagendar(token, id, dia(24, 13));
    expect(resposta.statusCode).toBe(409);
    const corpo = resposta.json<{ erro: string; dias: { slots: { inicio: string }[] }[] }>();
    expect(corpo.erro).toBe('SLOT_INDISPONIVEL');
    expect(corpo.dias.flatMap((d) => d.slots.map((s) => s.inicio))).not.toContain(dia(24, 13));
    expect(await prisma.agendamento.findUniqueOrThrow({ where: { id } })).toMatchObject({
      reagendamentos: 0,
      inicio: new Date(dia(24, 12)),
    });
  });

  it('não aceita o mesmo horário, horário fora da grade, nem agendamento de outro onboarding', async () => {
    const { token, id } = await agendado(dia(25, 12));
    const alheio = await agendado(dia(25, 13));
    expect((await reagendar(token, id, dia(25, 12))).json<{ motivo: string }>().motivo).toBe(
      'mesmo_horario',
    );
    expect((await reagendar(token, id, '2026-11-25T14:30:00.000Z')).statusCode).toBe(409);
    expect((await reagendar(token, alheio.id, dia(25, 14))).statusCode).toBe(404);
    expect((await reagendar('lixo', id, dia(25, 14))).statusCode).toBe(404);
  });

  it('ao remarcar, o horário do próprio agendamento não conta como ocupado', async () => {
    const { id } = await agendado('2026-12-02T12:00:00.000Z');
    const contexto = await carregarContexto(prisma, agenciaA);
    const inicios = async (ignorar?: string) =>
      (
        await slotsLivres(contexto, 'reuniao', '2026-12-02', '2026-12-02', AGORA_TESTE, ignorar)
      ).map((s) => s.inicio.toISOString());
    expect(await inicios()).not.toContain('2026-12-02T12:00:00.000Z');
    expect(await inicios(id)).toContain('2026-12-02T12:00:00.000Z');
  });

  it('agendamento cancelado não pode ser reagendado', async () => {
    const { token, id } = await agendado(dia(26, 12));
    await acao(appAdmin, id, 'cancelar', { motivo: 'Cliente desistiu' });
    const resposta = await reagendar(token, id, dia(26, 13));
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json<{ motivo: string }>().motivo).toBe('status_invalido');
  });

  it('dois clientes indo para o mesmo horário ao mesmo tempo: só um consegue', async () => {
    const um = await agendado(dia(27, 12));
    const dois = await agendado(dia(27, 13));
    const respostas = await Promise.all([
      reagendar(um.token, um.id, dia(27, 14)),
      reagendar(dois.token, dois.id, dia(27, 14)),
    ]);
    expect(respostas.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      await prisma.agendamento.count({
        where: {
          agenciaId: agenciaA,
          inicio: new Date(dia(27, 14)),
          status: { in: ['agendado', 'reagendado'] },
        },
      }),
    ).toBe(1);
  });

  it('duas trocas do mesmo cliente ao mesmo tempo nunca perdem nem contam a mais', async () => {
    const { token, id } = await agendado(dia(30, 12));
    const respostas = await Promise.all([
      reagendar(token, id, dia(30, 13)),
      reagendar(token, id, dia(30, 14)),
    ]);
    // Se a segunda chega depois da primeira terminar, são duas trocas válidas (o limite é 2); se
    // chegam juntas, a conferência do contador deixa passar só uma. Nos dois casos, o contador
    // tem de bater exatamente com as trocas aceitas e o horário final é o de uma delas.
    const aceitas = respostas.filter((r) => r.statusCode === 200);
    expect(aceitas.length).toBeGreaterThanOrEqual(1);
    for (const recusada of respostas.filter((r) => r.statusCode !== 200)) {
      expect(recusada.statusCode).toBe(422);
    }
    const gravado = await prisma.agendamento.findUniqueOrThrow({ where: { id } });
    expect(gravado.reagendamentos).toBe(aceitas.length);
    expect([dia(30, 13), dia(30, 14)]).toContain(gravado.inicio.toISOString());
    expect(
      await prisma.agendamento.count({
        where: {
          onboardingId: (await prisma.agendamento.findUniqueOrThrow({ where: { id } }))
            .onboardingId,
        },
      }),
    ).toBe(1);
  });
});

describe('RN-36 e RN-37 a agência cancela e marca o resultado', () => {
  it('o Admin cancela com motivo, o horário volta a ficar livre e o evento sai', async () => {
    const { id, onboardingId } = await agendado(dia(18, 14));
    const resposta = await acao(appAdmin, id, 'cancelar', { motivo: 'Pedido do cliente' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ agendamento: { id, status: 'cancelado' } });
    expect(await prisma.agendamento.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'cancelado',
      motivoCancelamento: 'Pedido do cliente',
    });
    const auditoria = await prisma.auditoriaLog.findFirstOrThrow({
      where: { entidadeId: id, acao: 'agendamento.cancelado' },
    });
    expect(auditoria.ator).toBe(`usuario:${adminA}`);
    expect(eventos).toContainEqual({
      tipo: 'agendamento.cancelado',
      dados: expect.objectContaining({ agendamentoId: id, onboardingId }) as Record<
        string,
        unknown
      >,
    });

    const outro = await novoCliente();
    expect(await slotsDoDia(outro.token, '2026-11-18')).toContain(dia(18, 14));
  });

  it('o responsável do onboarding também pode; outro membro não', async () => {
    const { id } = await agendado(dia(23, 13), { responsavelId: responsavelA });
    expect((await acao(appOutroMembro, id, 'nao-compareceu')).statusCode).toBe(403);
    expect((await acao(appResponsavel, id, 'nao-compareceu')).statusCode).toBe(200);
  });

  it('marca a falta (RN-37) e a reunião realizada, com evento para a mensagem de reagendamento', async () => {
    const falta = await agendado(dia(23, 14));
    const feita = await agendado(dia(24, 14));
    expect(
      (await acao(appAdmin, falta.id, 'nao-compareceu')).json<{ agendamento: { status: string } }>()
        .agendamento.status,
    ).toBe('nao_compareceu');
    expect(
      (await acao(appAdmin, feita.id, 'realizado')).json<{ agendamento: { status: string } }>()
        .agendamento.status,
    ).toBe('realizado');
    expect(eventos).toContainEqual({
      tipo: 'agendamento.nao_compareceu',
      dados: expect.objectContaining({ agendamentoId: falta.id }) as Record<string, unknown>,
    });
    expect(eventos).toContainEqual({
      tipo: 'agendamento.realizado',
      dados: expect.objectContaining({ agendamentoId: feita.id }) as Record<string, unknown>,
    });
  });

  it('um estado final não muda mais', async () => {
    const { id } = await agendado(dia(25, 14));
    await acao(appAdmin, id, 'cancelar', { motivo: 'x' });
    for (const nome of ['cancelar', 'realizado', 'nao-compareceu'] as const) {
      const resposta = await acao(appAdmin, id, nome, { motivo: 'y' });
      expect(resposta.statusCode, nome).toBe(422);
      expect(resposta.json<{ erro: string }>().erro).toBe('RN-36');
    }
  });

  it('cancelar exige o motivo', async () => {
    const { id } = await agendado(dia(26, 14));
    expect((await acao(appAdmin, id, 'cancelar')).statusCode).toBe(400);
    expect((await acao(appAdmin, id, 'cancelar', { motivo: '   ' })).statusCode).toBe(400);
    expect((await acao(appAdmin, id, 'cancelar', { motivo: 'x'.repeat(201) })).statusCode).toBe(
      400,
    );
  });

  it('exige login e não alcança agendamento de outra agência (RN-75)', async () => {
    const { id } = await agendado('2026-12-01T12:00:00.000Z');
    expect((await acao(appPublico, id, 'realizado')).statusCode).toBe(401);
    expect((await acao(appAdminB, id, 'cancelar', { motivo: 'x' })).statusCode).toBe(404);
    expect((await prisma.agendamento.findUniqueOrThrow({ where: { id } })).status).toBe('agendado');
  });
});
