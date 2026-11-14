import { randomUUID } from 'node:crypto';
import { MAX_TENTATIVAS } from '@convergia/core/calendario';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CalendarioEmMemoria } from '../../adapters/calendario/em-memoria.js';
import { construirApp } from '../../app.js';
import { criarBarramentoEmMemoria } from '../../base/eventos.js';
import { criarPrisma } from '../../base/prisma.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../testes/dependencias.js';
import { processarPendentes, sincronizarAgendamento } from './sincronizar-calendario.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const apps: FastifyInstance[] = [];
const sufixo = randomUUID().slice(0, 8);
const MIN = 60 * 1000;
const dia = (n: number, hora: number) => `2026-11-${String(n)}T${String(hora)}:00:00.000Z`;

let agenciaA: string;
let adminA: string;
let appAdmin: FastifyInstance;
let appPublico: FastifyInstance;
const eventosRecebidos: string[] = [];
const eventos = criarBarramentoEmMemoria((erro) => {
  throw erro;
});
eventos.assinar('agendamento.calendario_falhou', (e) => {
  eventosRecebidos.push(e.dados.agendamentoId);
  return Promise.resolve();
});

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
  const app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuario),
    }),
  );
  apps.push(app);
  return app;
}

beforeAll(async () => {
  agenciaA = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  await prisma.configAgencia.create({ data: { agenciaId: agenciaA, ...CONFIG_PADRAO } });
  adminA = (
    await prisma.usuario.create({
      data: { agenciaId: agenciaA, nome: 'Admin', email: `admin-${sufixo}@ag.com`, papel: 'admin' },
    })
  ).id;
  appAdmin = construir(usuarioTeste({ agenciaId: agenciaA, id: adminA }));
  appPublico = construir(null);
  await Promise.all(apps.map((a) => a.ready()));
  for (const diaSemana of [1, 2, 3, 4, 5]) {
    await appAdmin.inject({
      method: 'POST',
      url: '/agenda/disponibilidades',
      payload: { tipo: 'reuniao', diaSemana, horaInicio: '09:00', horaFim: '12:00' },
    });
  }
});

afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await prisma.agencia.deleteMany({ where: { id: agenciaA } });
  await prisma.$disconnect();
});

let contador = 0;
async function agendado(inicio: string, extra: Record<string, unknown> = {}) {
  contador += 1;
  const cliente = (
    await appAdmin.inject({
      method: 'POST',
      url: '/clientes',
      payload: { nomeEmpresa: `Empresa ${String(contador)}`, nomeContato: 'Contato', ...extra },
    })
  ).json<{ link: { token: string } }>();
  const reserva = await appPublico.inject({
    method: 'POST',
    url: `/publico/onboardings/${cliente.link.token}/agendamentos`,
    payload: { tipo: 'reuniao', inicio },
  });
  expect(reserva.statusCode).toBe(201);
  return {
    token: cliente.link.token,
    id: reserva.json<{ agendamento: { id: string } }>().agendamento.id,
  };
}
let sequenciaDeEmail = 0;
// Cada chamada devolve um e-mail novo: repetir o e-mail dispararia o alerta de duplicidade (RN-07).
const email = () => ({ email: `cliente${String((sequenciaDeEmail += 1))}-${sufixo}@teste.com` });
const sincronizar = (calendario: CalendarioEmMemoria, id: string, agora = AGORA_TESTE) =>
  sincronizarAgendamento(prisma, calendario, eventos, id, agora);
const ler = (id: string) => prisma.agendamento.findUniqueOrThrow({ where: { id } });

describe('RN-34 criar o evento no calendário', () => {
  it('cria o evento com convite ao cliente e link de videochamada, e guarda o identificador', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(17, 12), email());
    expect(await ler(id)).toMatchObject({ calendarioSituacao: 'pendente', eventoExternoId: null });

    expect(await sincronizar(calendario, id)).toBe('sincronizado');
    const gravado = await ler(id);
    expect(gravado).toMatchObject({
      calendarioSituacao: 'sincronizado',
      calendarioTentativas: 0,
      calendarioErro: null,
    });
    expect(gravado.eventoExternoId).toBeTruthy();
    expect(gravado.localOuLink).toMatch(/^https:\/\/meet\./);

    const evento = calendario.eventos.get(gravado.eventoExternoId ?? '');
    expect(evento).toMatchObject({
      titulo: expect.stringMatching(/Empresa/) as string,
      inicio: new Date(dia(17, 12)),
      fim: new Date(dia(17, 13)),
      comVideochamada: true,
      convidados: [expect.stringMatching(/@teste\.com$/) as string],
    });
  });

  it('cliente sem e-mail também ganha evento, só que sem convite', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(17, 13), { whatsapp: '(31) 99999-8888' });
    expect(await sincronizar(calendario, id)).toBe('sincronizado');
    expect([...calendario.eventos.values()][0]?.convidados).toEqual([]);
  });

  it('uma segunda sincronização do mesmo agendamento não cria outro evento', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(17, 14), email());
    await sincronizar(calendario, id);
    expect(await sincronizar(calendario, id)).toBe('ignorado');
    expect(calendario.chamadas).toHaveLength(1);
  });
});

describe('RN-36 reagendar e cancelar refletem no calendário', () => {
  it('reagendar atualiza o mesmo evento', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id, token } = await agendado(dia(18, 12), email());
    await sincronizar(calendario, id);
    const eventoId = (await ler(id)).eventoExternoId ?? '';

    await appPublico.inject({
      method: 'POST',
      url: `/publico/onboardings/${token}/agendamentos/${id}/reagendar`,
      payload: { inicio: dia(18, 13) },
    });
    expect(await ler(id)).toMatchObject({ calendarioSituacao: 'pendente' });
    expect(await sincronizar(calendario, id)).toBe('sincronizado');

    expect(calendario.chamadas.map((c) => c.acao)).toEqual(['criar', 'atualizar']);
    expect(calendario.eventos.size).toBe(1);
    expect(calendario.eventos.get(eventoId)?.inicio).toEqual(new Date(dia(18, 13)));
  });

  it('cancelar pela agência remove o evento', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(18, 14), email());
    await sincronizar(calendario, id);

    await appAdmin.inject({
      method: 'POST',
      url: `/agendamentos/${id}/cancelar`,
      payload: { motivo: 'Pedido do cliente' },
    });
    expect(await sincronizar(calendario, id)).toBe('sincronizado');
    expect(calendario.eventos.size).toBe(0);
    expect(calendario.chamadas.map((c) => c.acao)).toEqual(['criar', 'cancelar']);
  });

  it('cancelar um agendamento que nunca chegou ao calendário não chama o Google', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(19, 12), email());
    await appAdmin.inject({
      method: 'POST',
      url: `/agendamentos/${id}/cancelar`,
      payload: { motivo: 'x' },
    });
    expect(await sincronizar(calendario, id)).toBe('sincronizado');
    expect(calendario.chamadas).toEqual([]);
  });

  it('reunião realizada ou com falta não mexe no evento', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(19, 13), email());
    await sincronizar(calendario, id);
    await appAdmin.inject({ method: 'POST', url: `/agendamentos/${id}/nao-compareceu` });
    expect(await sincronizar(calendario, id)).toBe('sincronizado');
    expect(calendario.chamadas.map((c) => c.acao)).toEqual(['criar']);
    expect(calendario.eventos.size).toBe(1);
  });
});

describe('RN-67 falha do calendário não corrompe o agendamento', () => {
  it('guarda a pendência, não mexe no agendamento e tenta de novo depois da espera', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(19, 14), email());
    calendario.falharProximas(1);

    expect(await sincronizar(calendario, id)).toBe('adiado');
    const depoisDaFalha = await ler(id);
    expect(depoisDaFalha).toMatchObject({
      status: 'agendado',
      calendarioSituacao: 'pendente',
      calendarioTentativas: 1,
      eventoExternoId: null,
    });
    expect(depoisDaFalha.calendarioErro).toMatch(/indispon/i);
    expect(depoisDaFalha.calendarioProximaTentativaEm).toEqual(
      new Date(AGORA_TESTE.getTime() + 1 * MIN),
    );

    // Antes da espera acabar, nada é tentado.
    expect(await sincronizar(calendario, id, new Date(AGORA_TESTE.getTime() + 30_000))).toBe(
      'ignorado',
    );
    expect(calendario.chamadas).toEqual([]);
    // Depois dela, a nova tentativa dá certo.
    expect(await sincronizar(calendario, id, new Date(AGORA_TESTE.getTime() + 2 * MIN))).toBe(
      'sincronizado',
    );
    expect(await ler(id)).toMatchObject({
      calendarioSituacao: 'sincronizado',
      calendarioErro: null,
    });
  });

  it('a espera cresce a cada falha e, esgotadas as tentativas, desiste e avisa a agência', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(23, 12), email());
    calendario.falharProximas(99);

    let agora = AGORA_TESTE;
    const esperas: number[] = [];
    // A primeira chamada mais uma por espera: só a última falha desiste.
    for (let i = 0; i <= MAX_TENTATIVAS; i += 1) {
      const resultado = await sincronizar(calendario, id, agora);
      const gravado = await ler(id);
      if (resultado === 'adiado') {
        esperas.push(
          ((gravado.calendarioProximaTentativaEm ?? agora).getTime() - agora.getTime()) / MIN,
        );
        agora = new Date((gravado.calendarioProximaTentativaEm ?? agora).getTime() + 1);
      }
    }
    expect(esperas).toEqual([1, 5, 15, 60, 360]);
    const final = await ler(id);
    expect(final).toMatchObject({
      calendarioSituacao: 'falhou',
      calendarioTentativas: MAX_TENTATIVAS + 1,
      status: 'agendado',
    });
    expect(eventosRecebidos).toContain(id);
    expect(
      await prisma.auditoriaLog.count({
        where: { entidadeId: id, acao: 'agendamento.calendario_falhou' },
      }),
    ).toBe(1);
    // Depois de falhar, o worker não insiste.
    expect(await sincronizar(calendario, id, new Date(agora.getTime() + 24 * 60 * MIN))).toBe(
      'ignorado',
    );
  });

  it('erro definitivo, como credencial inválida, desiste na hora', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(23, 13), email());
    calendario.falharProximas(1, false);
    expect(await sincronizar(calendario, id)).toBe('falhou');
    expect(await ler(id)).toMatchObject({ calendarioSituacao: 'falhou', calendarioTentativas: 1 });
    expect(eventosRecebidos).toContain(id);
  });
});

describe('worker de sincronização', () => {
  it('processa só os pendentes que já podem ser tentados', async () => {
    const calendario = new CalendarioEmMemoria();
    const a = await agendado(dia(24, 12), email());
    const b = await agendado(dia(24, 13), email());
    await prisma.agendamento.update({
      where: { id: b.id },
      data: { calendarioProximaTentativaEm: new Date(AGORA_TESTE.getTime() + 60 * MIN) },
    });

    const feitos = await processarPendentes(prisma, calendario, eventos, AGORA_TESTE, 500);
    expect(feitos).toBeGreaterThanOrEqual(1);
    expect(await ler(a.id)).toMatchObject({ calendarioSituacao: 'sincronizado' });
    expect(await ler(b.id)).toMatchObject({ calendarioSituacao: 'pendente' });
  });

  it('dois workers ao mesmo tempo não criam o evento duas vezes', async () => {
    const calendario = new CalendarioEmMemoria();
    const { id } = await agendado(dia(25, 12), email());
    const resultados = await Promise.all([
      sincronizar(calendario, id),
      sincronizar(calendario, id),
      sincronizar(calendario, id),
    ]);
    expect(resultados.filter((r) => r === 'sincronizado')).toHaveLength(1);
    expect(calendario.chamadas.filter((c) => c.acao === 'criar')).toHaveLength(1);
  });
});

describe('worker ligado ao app', () => {
  it('ao reservar, o evento chega ao calendário sozinho, sem ninguém chamar o worker', async () => {
    const calendario = new CalendarioEmMemoria();
    const app = construirApp(
      { LOG_LEVEL: 'silent' },
      dependenciasDeTeste({
        prisma,
        calendario,
        relogio: relogioFixo(AGORA_TESTE),
        resolverSessao: () => Promise.resolve(null),
      }),
    );
    await app.ready();

    contador += 1;
    const cliente = (
      await appAdmin.inject({
        method: 'POST',
        url: '/clientes',
        payload: { nomeEmpresa: `Empresa ${String(contador)}`, nomeContato: 'C', ...email() },
      })
    ).json<{ link: { token: string } }>();
    const reserva = await app.inject({
      method: 'POST',
      url: `/publico/onboardings/${cliente.link.token}/agendamentos`,
      payload: { tipo: 'reuniao', inicio: dia(26, 12) },
    });
    expect(reserva.statusCode).toBe(201);
    const { id } = reserva.json<{ agendamento: { id: string } }>().agendamento;

    // A resposta ao cliente não esperou o Google; o evento aparece logo depois. O worker atende as
    // pendências de todas as agências, então o teste olha só o evento deste agendamento.
    for (let i = 0; i < 400 && (await ler(id)).calendarioSituacao !== 'sincronizado'; i += 1) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const gravado = await ler(id);
    expect(gravado.calendarioSituacao).toBe('sincronizado');
    expect(calendario.eventos.has(gravado.eventoExternoId ?? '')).toBe(true);
    // O worker varre as pendências de todas as agências: fecha o app para não mexer nos testes seguintes.
    await app.close();
  }, 30_000);

  it('sem calendário configurado o app funciona e o agendamento fica pendente', async () => {
    const { id } = await agendado(dia(26, 13), email());
    await new Promise((r) => setTimeout(r, 150));
    expect(await ler(id)).toMatchObject({
      calendarioSituacao: 'pendente',
      eventoExternoId: null,
      status: 'agendado',
    });
  });
});
