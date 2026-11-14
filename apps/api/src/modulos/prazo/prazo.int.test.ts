import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type EventoDominio } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarBarramentoEmMemoria } from '../../base/eventos.js';
import { criarPrisma } from '../../base/prisma.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../testes/dependencias.js';
import { recalcularPrazo } from './recalcular.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const apps: FastifyInstance[] = [];
const agencias: string[] = [];
const sufixo = randomUUID().slice(0, 8);

// AGORA_TESTE: segunda 16/11/2026 09:00 em São Paulo. Reunião na terça 17/11 às 09:00.
const REUNIAO = '2026-11-17T12:00:00.000Z';
const QUARTA_9H = '2026-11-18T12:00:00.000Z';
const QUINTA_9H = '2026-11-19T12:00:00.000Z';
const SEGUNDA_9H = '2026-11-23T12:00:00.000Z';

interface Cenario {
  agenciaId: string;
  admin: FastifyInstance;
  publico: FastifyInstance;
  alterados: EventoDominio<'prazo.alterado'>[];
}

/** Agência própria por teste: um só profissional, então os horários não se atrapalham. */
async function cenario(): Promise<Cenario> {
  const agenciaId = (await prisma.agencia.create({ data: { nome: `Prazo ${sufixo}` } })).id;
  agencias.push(agenciaId);
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const adm = await prisma.usuario.create({
    data: {
      agenciaId,
      nome: 'Admin',
      email: `adm-${randomUUID().slice(0, 8)}@prazo.com`,
      papel: 'admin',
    },
  });
  const eventos = criarBarramentoEmMemoria((erro) => {
    throw erro;
  });
  const alterados: EventoDominio<'prazo.alterado'>[] = [];
  eventos.assinar('prazo.alterado', (e) => {
    alterados.push(e);
    return Promise.resolve();
  });
  const construir = (comUsuario: boolean) => {
    const app = construirApp(
      { LOG_LEVEL: 'silent' },
      dependenciasDeTeste({
        prisma,
        eventos,
        relogio: relogioFixo(AGORA_TESTE),
        resolverSessao: () =>
          Promise.resolve(comUsuario ? usuarioTeste({ agenciaId, id: adm.id }) : null),
      }),
    );
    apps.push(app);
    return app;
  };
  const admin = construir(true);
  const publico = construir(false);
  await Promise.all([admin.ready(), publico.ready()]);
  for (const tipo of ['reuniao', 'captacao']) {
    for (const diaSemana of [1, 2, 3, 4, 5]) {
      await admin.inject({
        method: 'POST',
        url: '/agenda/disponibilidades',
        payload: { tipo, diaSemana, horaInicio: '09:00', horaFim: '18:00' },
      });
    }
  }
  return { agenciaId, admin, publico, alterados };
}

afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await prisma.agencia.deleteMany({ where: { id: { in: agencias } } });
  await prisma.$disconnect();
});

async function clienteComReuniao(c: Cenario) {
  const r = await c.admin.inject({
    method: 'POST',
    url: '/clientes',
    payload: {
      nomeEmpresa: 'Cliente',
      nomeContato: 'Contato',
      email: `c-${randomUUID().slice(0, 8)}@t.com`,
    },
  });
  const corpo = r.json<{ cliente: { onboarding: { id: string } }; link: { token: string } }>();
  const token = corpo.link.token;
  expect((await reservar(c, token, 'reuniao', REUNIAO)).statusCode).toBe(201);
  return { token, onboardingId: corpo.cliente.onboarding.id };
}

const reservar = (c: Cenario, token: string, tipo: string, inicio: string) =>
  c.publico.inject({
    method: 'POST',
    url: `/publico/onboardings/${token}/agendamentos`,
    payload: {
      tipo,
      inicio,
      ...(tipo === 'captacao' ? { captacao: { presencial: true, local: 'Rua A, 10' } } : {}),
    },
  });

const prazo = async (c: Cenario, token: string) =>
  (await c.publico.inject({ method: 'GET', url: `/publico/onboardings/${token}/prazo` })).json<{
    definido: boolean;
    data?: string;
  }>();

async function idDaCaptacao(c: Cenario, token: string): Promise<string> {
  const r = await c.publico.inject({
    method: 'GET',
    url: `/publico/onboardings/${token}/agendamentos`,
  });
  const id = r
    .json<{ agendamentos: { id: string; tipo: string }[] }>()
    .agendamentos.find((a) => a.tipo === 'captacao')?.id;
  if (!id) throw new Error('sem captação');
  return id;
}

const reagendar = async (c: Cenario, token: string, inicio: string) =>
  c.publico.inject({
    method: 'POST',
    url: `/publico/onboardings/${token}/agendamentos/${await idDaCaptacao(c, token)}/reagendar`,
    payload: { inicio },
  });

describe('RN-45 prazo só depois da captação agendada', () => {
  it('não há prazo antes de agendar a captação', async () => {
    const c = await cenario();
    const { token } = await clienteComReuniao(c);
    expect(await prazo(c, token)).toEqual({ definido: false });
    expect(c.alterados).toEqual([]);
  });

  it('o link inválido não revela nada', async () => {
    const c = await cenario();
    const r = await c.publico.inject({
      method: 'GET',
      url: '/publico/onboardings/nao-existe/prazo',
    });
    expect(r.statusCode).toBe(404);
  });
});

describe('RN-43 e RN-44 cálculo ao agendar a captação', () => {
  it('captação na quarta 18/11 + 5 dias úteis, pulando o feriado de 20/11 = 26/11', async () => {
    const c = await cenario();
    const { token, onboardingId } = await clienteComReuniao(c);
    expect((await reservar(c, token, 'captacao', QUARTA_9H)).statusCode).toBe(201);

    expect(await prazo(c, token)).toEqual({ definido: true, data: '2026-11-26' });
    expect(c.alterados.map((e) => e.dados)).toEqual([
      { onboardingId, data: '2026-11-26', anterior: null, origem: 'calculado' },
    ]);
    const auditoria = await prisma.auditoriaLog.findMany({
      where: { entidadeId: onboardingId, acao: { startsWith: 'prazo.' } },
    });
    expect(auditoria.map((a) => a.acao)).toEqual(['prazo.calculado']);
  });

  it('usa o prazo de produção configurado e os bloqueios da agência', async () => {
    const c = await cenario();
    await prisma.configAgencia.updateMany({
      where: { agenciaId: c.agenciaId },
      data: { prazoProducaoDiasUteis: 2 },
    });
    await c.admin.inject({
      method: 'POST',
      url: '/agenda/bloqueios',
      payload: { dataInicio: '2026-11-23', dataFim: '2026-11-23', motivo: 'Recesso' },
    });
    const { token } = await clienteComReuniao(c);
    await reservar(c, token, 'captacao', QUINTA_9H);
    // Quinta 19 + 2: (sex 20 feriado, seg 23 bloqueado) ter 24, qua 25.
    expect(await prazo(c, token)).toEqual({ definido: true, data: '2026-11-25' });
  });
});

describe('RN-46 recálculo quando a captação muda', () => {
  it('reagendar para outro dia recalcula e avisa a data nova', async () => {
    const c = await cenario();
    const { token, onboardingId } = await clienteComReuniao(c);
    await reservar(c, token, 'captacao', QUARTA_9H);
    expect((await reagendar(c, token, SEGUNDA_9H)).statusCode).toBe(200);

    // Segunda 23 + 5 = segunda 30/11.
    expect(await prazo(c, token)).toEqual({ definido: true, data: '2026-11-30' });
    expect(c.alterados.at(-1)?.dados).toEqual({
      onboardingId,
      data: '2026-11-30',
      anterior: '2026-11-26',
      origem: 'calculado',
    });
  });

  it('trocar o horário no mesmo dia não muda o prazo nem avisa de novo', async () => {
    const c = await cenario();
    const { token } = await clienteComReuniao(c);
    await reservar(c, token, 'captacao', QUARTA_9H);
    expect((await reagendar(c, token, '2026-11-18T16:00:00.000Z')).statusCode).toBe(200);
    expect(await prazo(c, token)).toEqual({ definido: true, data: '2026-11-26' });
    expect(c.alterados).toHaveLength(1);
  });

  it('captação cancelada pela agência desfaz o prazo', async () => {
    const c = await cenario();
    const { token, onboardingId } = await clienteComReuniao(c);
    await reservar(c, token, 'captacao', QUARTA_9H);
    const cancelar = await c.admin.inject({
      method: 'POST',
      url: `/agendamentos/${await idDaCaptacao(c, token)}/cancelar`,
      payload: { motivo: 'Chuva' },
    });
    expect(cancelar.statusCode).toBe(200);
    expect(await prazo(c, token)).toEqual({ definido: false });
    expect(c.alterados.at(-1)?.dados).toEqual({
      onboardingId,
      data: null,
      anterior: '2026-11-26',
      origem: 'calculado',
    });
  });

  it('cancelar a reunião não mexe no prazo', async () => {
    const c = await cenario();
    const { token } = await clienteComReuniao(c);
    await reservar(c, token, 'captacao', QUARTA_9H);
    const lista = await c.publico.inject({
      method: 'GET',
      url: `/publico/onboardings/${token}/agendamentos`,
    });
    const reuniao = lista
      .json<{ agendamentos: { id: string; tipo: string }[] }>()
      .agendamentos.find((a) => a.tipo === 'reuniao');
    await c.admin.inject({
      method: 'POST',
      url: `/agendamentos/${reuniao?.id ?? ''}/cancelar`,
      payload: { motivo: 'Imprevisto' },
    });
    expect(await prazo(c, token)).toEqual({ definido: true, data: '2026-11-26' });
  });

  it('recalcular de novo sem mudança não grava nem avisa', async () => {
    const c = await cenario();
    const { token, onboardingId } = await clienteComReuniao(c);
    await reservar(c, token, 'captacao', QUARTA_9H);
    const eventos = criarBarramentoEmMemoria(() => undefined);
    const resultado = await recalcularPrazo(
      prisma,
      eventos,
      c.agenciaId,
      onboardingId,
      AGORA_TESTE,
    );
    expect(resultado).toEqual({ mudou: false, data: '2026-11-26' });
  });

  it('reagendamentos simultâneos terminam com um prazo coerente com a captação', async () => {
    const c = await cenario();
    const { token, onboardingId } = await clienteComReuniao(c);
    await reservar(c, token, 'captacao', QUARTA_9H);
    await Promise.all([
      recalcularPrazo(
        prisma,
        criarBarramentoEmMemoria(() => undefined),
        c.agenciaId,
        onboardingId,
        AGORA_TESTE,
      ),
      recalcularPrazo(
        prisma,
        criarBarramentoEmMemoria(() => undefined),
        c.agenciaId,
        onboardingId,
        AGORA_TESTE,
      ),
    ]);
    expect(await prisma.prazoLiberacao.count({ where: { onboardingId } })).toBe(1);
  });
});
