import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarBarramentoEmMemoria } from '../../base/eventos.js';
import { criarPrisma } from '../../base/prisma.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../testes/dependencias.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const apps: FastifyInstance[] = [];
const sufixo = randomUUID().slice(0, 8);
const MS_DIA = 24 * 60 * 60 * 1000;
// AGORA_TESTE é segunda 16/11/2026 09:00 em São Paulo. Com 24h de antecedência, o primeiro slot
// é terça 09:00 (12:00 UTC).
const TERCA_9H = '2026-11-17T12:00:00.000Z';
const TERCA_10H = '2026-11-17T13:00:00.000Z';
const TERCA_11H = '2026-11-17T14:00:00.000Z';

let agenciaA: string;
let agenciaB: string;
let appAdmin: FastifyInstance;
let appAdminB: FastifyInstance;
let appPublico: FastifyInstance;
const eventosRecebidos: unknown[] = [];

function construir(usuario: UsuarioAutenticado | null, agora = AGORA_TESTE): FastifyInstance {
  const eventos = criarBarramentoEmMemoria((erro) => {
    throw erro;
  });
  eventos.assinar('agendamento.criado', (evento) => {
    eventosRecebidos.push(evento);
    return Promise.resolve();
  });
  const deps = dependenciasDeTeste({
    prisma,
    eventos,
    relogio: relogioFixo(agora),
    resolverSessao: () => Promise.resolve(usuario),
  });
  const app = construirApp({ LOG_LEVEL: 'silent' }, deps);
  apps.push(app);
  return app;
}

async function criarAgencia(nome: string) {
  const id = (await prisma.agencia.create({ data: { nome } })).id;
  await prisma.configAgencia.create({ data: { agenciaId: id, ...CONFIG_PADRAO } });
  const admin = await prisma.usuario.create({
    data: { agenciaId: id, nome: 'Admin', email: `admin-${nome}-${sufixo}@ag.com`, papel: 'admin' },
  });
  return { id, adminId: admin.id };
}

beforeAll(async () => {
  const a = await criarAgencia('A');
  const b = await criarAgencia('B');
  agenciaA = a.id;
  agenciaB = b.id;
  appAdmin = construir(usuarioTeste({ agenciaId: agenciaA, id: a.adminId }));
  appAdminB = construir(usuarioTeste({ agenciaId: agenciaB, id: b.adminId }));
  appPublico = construir(null);
  await Promise.all(apps.map((app) => app.ready()));
  // Segunda a sexta, 09:00 às 12:00, reunião de 60 minutos (padrão da configuração).
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
async function novoCliente(app = appAdmin) {
  contador += 1;
  const resposta = await app.inject({
    method: 'POST',
    url: '/clientes',
    payload: {
      nomeEmpresa: `Cliente ${String(contador)}`,
      nomeContato: 'Contato',
      email: `c${String(contador)}-${sufixo}@teste.com`,
    },
  });
  const corpo = resposta.json<{
    cliente: { id: string; onboarding: { id: string } };
    link: { token: string };
  }>();
  return { token: corpo.link.token, onboardingId: corpo.cliente.onboarding.id };
}

const slots = (
  token: string,
  consulta = 'tipo=reuniao&de=2026-11-16&ate=2026-11-18',
  app = appPublico,
) => app.inject({ method: 'GET', url: `/publico/onboardings/${token}/slots?${consulta}` });
const reservar = (
  token: string,
  inicio: string,
  extra: Record<string, unknown> = {},
  app = appPublico,
) =>
  app.inject({
    method: 'POST',
    url: `/publico/onboardings/${token}/agendamentos`,
    payload: { tipo: 'reuniao', inicio, ...extra },
  });

interface Dia {
  data: string;
  slots: { inicio: string; fim: string; hora: string }[];
}

describe('RN-30, RN-31 e RN-32 horários disponíveis para o cliente', () => {
  it('lista os slots a partir da antecedência mínima, no fuso da agência', async () => {
    const { token } = await novoCliente();
    const resposta = await slots(token);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['cache-control']).toBe('no-store');
    expect(resposta.json()).toEqual({
      fuso: 'America/Sao_Paulo',
      dias: [
        {
          data: '2026-11-17',
          slots: [
            { inicio: TERCA_9H, fim: TERCA_10H, hora: '09:00' },
            { inicio: TERCA_10H, fim: TERCA_11H, hora: '10:00' },
            { inicio: TERCA_11H, fim: '2026-11-17T15:00:00.000Z', hora: '11:00' },
          ],
        },
        { data: '2026-11-18', slots: expect.any(Array) as unknown[] },
      ],
    });
  });

  it('mostra no fuso do cliente quando ele informa (RN-32)', async () => {
    const { token } = await novoCliente();
    const { fuso, dias } = (
      await slots(token, 'tipo=reuniao&de=2026-11-17&ate=2026-11-17&fuso=Asia/Tokyo')
    ).json<{ fuso: string; dias: Dia[] }>();
    expect(fuso).toBe('Asia/Tokyo');
    expect(dias[0]).toMatchObject({
      data: '2026-11-17',
      slots: [{ inicio: TERCA_9H, hora: '21:00' }, { hora: '22:00' }, { hora: '23:00' }],
    });
  });

  it('sem período informado, devolve as próximas duas semanas', async () => {
    const { token } = await novoCliente();
    const { dias } = (await slots(token, 'tipo=reuniao')).json<{ dias: Dia[] }>();
    expect(dias.length).toBeGreaterThanOrEqual(8);
    expect(dias[0]?.data).toBe('2026-11-17');
  });

  it('tira feriado nacional e bloqueio da agência', async () => {
    const { token } = await novoCliente();
    // 20/11 é feriado nacional (Consciência Negra); o bloqueio cobre 19/11.
    await appAdmin.inject({
      method: 'POST',
      url: '/agenda/bloqueios',
      payload: { dataInicio: '2026-11-19', dataFim: '2026-11-19', motivo: 'Folga' },
    });
    const { dias } = (await slots(token, 'tipo=reuniao&de=2026-11-18&ate=2026-11-23')).json<{
      dias: Dia[];
    }>();
    expect(dias.map((d) => d.data)).toEqual(['2026-11-18', '2026-11-23']);
  });

  it('recusa parâmetros inválidos', async () => {
    const { token } = await novoCliente();
    for (const consulta of [
      '',
      'tipo=jantar',
      'tipo=reuniao&de=2026-11-18&ate=2026-11-17',
      'tipo=reuniao&de=2026-01-01&ate=2026-12-31',
      'tipo=reuniao&fuso=Lua/Base_Alfa',
      'tipo=reuniao&de=ontem',
    ]) {
      expect((await slots(token, consulta)).statusCode, consulta).toBe(400);
    }
  });

  it('exige link válido: token errado 404, expirado 410', async () => {
    const { token } = await novoCliente();
    expect((await slots('lixo')).statusCode).toBe(404);
    const depois = construir(null, new Date(AGORA_TESTE.getTime() + 15 * MS_DIA));
    await depois.ready();
    expect((await slots(token, 'tipo=reuniao', depois)).statusCode).toBe(410);
  });

  it('só enxerga a agenda da própria agência (RN-75)', async () => {
    await appAdminB.inject({
      method: 'POST',
      url: '/agenda/bloqueios',
      payload: { dataInicio: '2026-12-01', dataFim: '2026-12-01', motivo: 'Só da B' },
    });
    const { token } = await novoCliente();
    const { dias } = (await slots(token, 'tipo=reuniao&de=2026-12-01&ate=2026-12-01')).json<{
      dias: Dia[];
    }>();
    expect(dias).toHaveLength(1);
  });
});

describe('RN-33 reserva do horário', () => {
  it('reserva, audita, publica o evento e tira o slot da lista', async () => {
    const { token, onboardingId } = await novoCliente();
    const resposta = await reservar(token, TERCA_9H);
    expect(resposta.statusCode).toBe(201);
    const { agendamento } = resposta.json<{
      agendamento: { id: string; tipo: string; inicio: string; fim: string; status: string };
    }>();
    expect(agendamento).toMatchObject({
      tipo: 'reuniao',
      inicio: TERCA_9H,
      fim: TERCA_10H,
      status: 'agendado',
    });

    const gravado = await prisma.agendamento.findUniqueOrThrow({ where: { id: agendamento.id } });
    expect(gravado).toMatchObject({ agenciaId: agenciaA, onboardingId, status: 'agendado' });
    const auditoria = await prisma.auditoriaLog.findFirstOrThrow({
      where: { entidadeId: agendamento.id, acao: 'agendamento.criado' },
    });
    expect(auditoria.ator).toBe(`cliente:${onboardingId}`);
    expect(eventosRecebidos).toContainEqual(
      expect.objectContaining({
        tipo: 'agendamento.criado',
        agenciaId: agenciaA,
        dados: expect.objectContaining({ agendamentoId: agendamento.id }) as unknown,
      }),
    );

    const outro = await novoCliente();
    const { dias } = (await slots(outro.token, 'tipo=reuniao&de=2026-11-17&ate=2026-11-17')).json<{
      dias: Dia[];
    }>();
    expect(dias[0]?.slots.map((s) => s.inicio)).toEqual([TERCA_10H, TERCA_11H]);
  });

  it('o horário já reservado por outro cliente volta 409 com a lista atualizada', async () => {
    const primeiro = await novoCliente();
    const segundo = await novoCliente();
    await reservar(primeiro.token, TERCA_10H);

    const resposta = await reservar(segundo.token, TERCA_10H);
    expect(resposta.statusCode).toBe(409);
    const corpo = resposta.json<{ erro: string; dias: Dia[] }>();
    expect(corpo.erro).toBe('SLOT_INDISPONIVEL');
    const inicios = corpo.dias.flatMap((d) => d.slots.map((s) => s.inicio));
    expect(inicios).not.toContain(TERCA_10H);
    expect(inicios.length).toBeGreaterThan(0);
  });

  it('um horário que não é um slot (fora da grade, da antecedência ou do expediente) é indisponível', async () => {
    const { token } = await novoCliente();
    for (const inicio of [
      '2026-11-17T12:30:00.000Z',
      '2026-11-16T13:00:00.000Z',
      '2026-11-17T20:00:00.000Z',
      '2026-11-21T13:00:00.000Z',
    ]) {
      const resposta = await reservar(token, inicio);
      expect(resposta.statusCode, inicio).toBe(409);
      expect(resposta.json<{ erro: string }>().erro).toBe('SLOT_INDISPONIVEL');
    }
    expect(
      await prisma.agendamento.count({
        where: { agenciaId: agenciaA, inicio: new Date('2026-11-17T12:30:00.000Z') },
      }),
    ).toBe(0);
  });

  it('um onboarding só tem uma reunião ativa', async () => {
    const { token } = await novoCliente();
    expect((await reservar(token, '2026-11-18T12:00:00.000Z')).statusCode).toBe(201);
    const segunda = await reservar(token, '2026-11-18T13:00:00.000Z');
    expect(segunda.statusCode).toBe(409);
    expect(segunda.json<{ erro: string }>().erro).toBe('JA_AGENDADO');
  });

  it('cancelar libera o horário e permite agendar de novo', async () => {
    const { token, onboardingId } = await novoCliente();
    const { agendamento } = (await reservar(token, '2026-11-18T14:00:00.000Z')).json<{
      agendamento: { id: string };
    }>();
    await prisma.agendamento.update({
      where: { id: agendamento.id },
      data: { status: 'cancelado' },
    });

    const outro = await novoCliente();
    expect((await reservar(outro.token, '2026-11-23T14:00:00.000Z')).statusCode).toBe(201);
    expect((await reservar(token, '2026-11-23T12:00:00.000Z')).statusCode).toBe(201);
    expect(await prisma.agendamento.count({ where: { onboardingId } })).toBe(2);
  });

  it('a mesma hora em outra agência não conflita (RN-75)', async () => {
    const daA = await novoCliente();
    const daB = await novoCliente(appAdminB);
    expect((await reservar(daA.token, '2026-11-24T12:00:00.000Z')).statusCode).toBe(201);
    expect((await reservar(daB.token, '2026-11-24T12:00:00.000Z')).statusCode).toBe(201);
  });

  it('exige link válido e corpo correto', async () => {
    const { token, onboardingId } = await novoCliente();
    expect((await reservar('lixo', TERCA_9H)).statusCode).toBe(404);
    expect((await reservar(token, 'amanhã')).statusCode).toBe(400);
    expect((await reservar(token, TERCA_9H, { tipo: 'jantar' })).statusCode).toBe(400);
    expect((await reservar(token, TERCA_9H, { fuso: 'Lua/Base_Alfa' })).statusCode).toBe(400);

    const depois = construir(null, new Date(AGORA_TESTE.getTime() + 15 * MS_DIA));
    await depois.ready();
    expect((await reservar(token, TERCA_9H, {}, depois)).statusCode).toBe(410);

    await prisma.onboarding.update({
      where: { id: onboardingId },
      data: { statusGeral: 'cancelado' },
    });
    expect((await reservar(token, TERCA_9H)).statusCode).toBe(404);
  });
});

describe('RN-33 sem overbooking, mesmo com disputa simultânea', () => {
  it('vários clientes pedindo o mesmo horário ao mesmo tempo: só um confirma', async () => {
    const clientes = await Promise.all(Array.from({ length: 8 }, () => novoCliente()));
    const alvo = '2026-11-26T12:00:00.000Z'; // quinta 26/11, 09:00
    const respostas = await Promise.all(clientes.map((c) => reservar(c.token, alvo)));

    // Mostra o corpo de qualquer resposta inesperada: só 201 e 409 são aceitáveis aqui.
    const inesperadas = respostas
      .filter((r) => r.statusCode !== 201 && r.statusCode !== 409)
      .map((r) => `${String(r.statusCode)} ${r.body}`);
    expect(inesperadas).toEqual([]);
    const status = respostas.map((r) => r.statusCode).sort();
    expect(status).toEqual([201, 409, 409, 409, 409, 409, 409, 409]);
    for (const r of respostas.filter((x) => x.statusCode === 409)) {
      expect(r.json<{ erro: string }>().erro).toBe('SLOT_INDISPONIVEL');
    }
    expect(
      await prisma.agendamento.count({
        where: { agenciaId: agenciaA, inicio: new Date(alvo), status: 'agendado' },
      }),
    ).toBe(1);
  });

  it('o mesmo cliente tentando dois horários ao mesmo tempo fica com um só', async () => {
    const { token, onboardingId } = await novoCliente();
    const respostas = await Promise.all([
      reservar(token, '2026-11-27T12:00:00.000Z'),
      reservar(token, '2026-11-27T13:00:00.000Z'),
    ]);
    expect(respostas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await prisma.agendamento.count({ where: { onboardingId, status: 'agendado' } })).toBe(1);
  });

  it('o banco recusa horários que se cruzam mesmo sem passar pelo código', async () => {
    const { onboardingId } = await novoCliente();
    const outro = await novoCliente();
    const base = { agenciaId: agenciaA, tipo: 'reuniao' as const };
    await prisma.agendamento.create({
      data: {
        ...base,
        onboardingId,
        inicio: new Date('2026-12-02T12:00:00Z'),
        fim: new Date('2026-12-02T13:00:00Z'),
      },
    });

    const cruzado = {
      ...base,
      onboardingId: outro.onboardingId,
      inicio: new Date('2026-12-02T12:30:00Z'),
      fim: new Date('2026-12-02T13:30:00Z'),
    };
    await expect(prisma.agendamento.create({ data: cruzado })).rejects.toThrow();
    // Quem começa quando o outro termina não cruza.
    await expect(
      prisma.agendamento.create({
        data: {
          ...cruzado,
          inicio: new Date('2026-12-02T13:00:00Z'),
          fim: new Date('2026-12-02T14:00:00Z'),
        },
      }),
    ).resolves.toBeDefined();
    // Fim antes do início é recusado.
    await expect(
      prisma.agendamento.create({
        data: {
          ...cruzado,
          inicio: new Date('2026-12-03T13:00:00Z'),
          fim: new Date('2026-12-03T12:00:00Z'),
        },
      }),
    ).rejects.toThrow();
  });
});
