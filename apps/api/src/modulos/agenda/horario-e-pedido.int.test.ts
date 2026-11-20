import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo } from '@convergia/core/base';
import { cifrarToken, gerarTokenLink } from '@convergia/core/link';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarPrisma } from '../../base/prisma.js';
import {
  AGORA_TESTE,
  CHAVE_LINK_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../testes/dependencias.js';

// AGORA_TESTE = segunda, 2026-11-16, 09:00 em São Paulo (UTC-3).
const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`);
const MS_HORA = 3_600_000;

let agenciaId: string;
let adminId: string;
let membroId: string;
let outroMembroId: string;
let appAdmin: FastifyInstance;
let appMembro: FastifyInstance;
let appOutro: FastifyInstance;

const construir = (id: string, papel: 'admin' | 'membro') =>
  construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuarioTeste({ agenciaId, id, papel })),
    }),
  );

async function criarAgendado(inicio: Date, opcoes: { reagendamentos?: number } = {}) {
  const cliente = await prisma.cliente.create({
    data: {
      agenciaId,
      nomeEmpresa: `Loja ${randomUUID().slice(0, 6)}`,
      nomeContato: 'Bia',
      whatsapp: '+5531999998888',
    },
  });
  const { token, hash } = gerarTokenLink();
  const o = await prisma.onboarding.create({
    data: {
      agenciaId,
      clienteId: cliente.id,
      responsavelId: membroId,
      statusGeral: 'aguardando_reuniao',
      link: {
        create: {
          agenciaId,
          tokenHash: hash,
          tokenCifrado: cifrarToken(token, CHAVE_LINK_TESTE),
          expiraEm: new Date(AGORA_TESTE.getTime() + 14 * 24 * MS_HORA),
        },
      },
    },
  });
  const a = await prisma.agendamento.create({
    data: {
      agenciaId,
      onboardingId: o.id,
      tipo: 'reuniao',
      inicio,
      fim: new Date(inicio.getTime() + MS_HORA),
      reagendamentos: opcoes.reagendamentos ?? 0,
    },
  });
  return { onboardingId: o.id, agendamentoId: a.id, token };
}

const alterar = (app: FastifyInstance, id: string, data: string, hora: string) =>
  app.inject({ method: 'PUT', url: `/agendamentos/${id}/horario`, payload: { data, hora } });

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `Agência ${sufixo}` } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const usuario = async (nome: string, papel: 'admin' | 'membro') =>
    (
      await prisma.usuario.create({
        data: { agenciaId, nome, email: `${nome}-${sufixo}@x.com`, papel },
      })
    ).id;
  adminId = await usuario('ana', 'admin');
  membroId = await usuario('rui', 'membro');
  outroMembroId = await usuario('eva', 'membro');
  appAdmin = construir(adminId, 'admin');
  appMembro = construir(membroId, 'membro');
  appOutro = construir(outroMembroId, 'membro');
  await Promise.all([appAdmin.ready(), appMembro.ready(), appOutro.ready()]);
});

afterAll(async () => {
  await Promise.all([appAdmin.close(), appMembro.close(), appOutro.close()]);
  await prisma.agencia.deleteMany({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('S8-4 a agência altera o horário', () => {
  it('o responsável muda para qualquer horário futuro, sem gastar o limite do cliente', async () => {
    const { agendamentoId, onboardingId } = await criarAgendado(sp('2026-11-18T10:00'), {
      reagendamentos: 1,
    });
    // Domingo às 21h: fora do horário de atendimento, mas a agência pode (decisão do PO).
    const r = await alterar(appMembro, agendamentoId, '2026-11-22', '21:00');
    expect(r.statusCode).toBe(200);

    const salvo = await prisma.agendamento.findUniqueOrThrow({ where: { id: agendamentoId } });
    expect(salvo.inicio.toISOString()).toBe(sp('2026-11-22T21:00').toISOString());
    expect(salvo.fim.getTime() - salvo.inicio.getTime()).toBe(MS_HORA);
    expect(salvo.status).toBe('reagendado');
    expect(salvo.reagendamentos).toBe(1);

    const auditoria = await prisma.auditoriaLog.findFirst({
      where: { agenciaId, acao: 'agendamento.horario_alterado', entidadeId: agendamentoId },
    });
    expect(auditoria?.ator).toBe(`usuario:${membroId}`);

    const aviso = await prisma.notificacao.findFirst({
      where: { onboardingId, tipo: 'horario_alterado' },
    });
    expect(aviso?.corpo).toContain('reunião');
    expect(aviso?.corpo).toContain('22/11/2026 às 21:00');
  });

  it('recusa horário que bate com outro agendamento (409) e horário no passado (422)', async () => {
    const ocupado = await criarAgendado(sp('2026-11-19T10:00'));
    const { agendamentoId } = await criarAgendado(sp('2026-11-19T14:00'));
    expect((await alterar(appAdmin, agendamentoId, '2026-11-19', '10:30')).statusCode).toBe(409);
    expect((await alterar(appAdmin, agendamentoId, '2026-11-15', '10:00')).statusCode).toBe(422);
    const salvo = await prisma.agendamento.findUniqueOrThrow({ where: { id: agendamentoId } });
    expect(salvo.inicio.toISOString()).toBe(sp('2026-11-19T14:00').toISOString());
    expect(ocupado.agendamentoId).not.toBe(agendamentoId);
  });

  it('membro que não é o responsável recebe 403 (RN-02)', async () => {
    const { agendamentoId } = await criarAgendado(sp('2026-11-20T10:00'));
    expect((await alterar(appOutro, agendamentoId, '2026-11-27', '10:00')).statusCode).toBe(403);
  });
});

describe('S8-4 pedido de reagendamento pelo cliente (RN-35)', () => {
  const pedir = (token: string, id: string, motivo = 'Vou viajar nessa semana') =>
    appAdmin.inject({
      method: 'POST',
      url: `/publico/onboardings/${token}/agendamentos/${id}/pedir-reagendamento`,
      payload: { motivo },
    });
  const listar = async (token: string) =>
    (
      await appAdmin.inject({ method: 'GET', url: `/publico/onboardings/${token}/agendamentos` })
    ).json<{ agendamentos: { pedidoEnviado: boolean; podeReagendar: boolean }[] }>().agendamentos;

  it('quem ainda pode reagendar sozinho não pede (422)', async () => {
    const { token, agendamentoId } = await criarAgendado(sp('2026-11-24T10:00'));
    expect((await pedir(token, agendamentoId)).statusCode).toBe(422);
  });

  it('passado o limite, o pedido vira aviso para a agência com o motivo, uma vez só', async () => {
    const { token, agendamentoId, onboardingId } = await criarAgendado(sp('2026-11-25T10:00'), {
      reagendamentos: CONFIG_PADRAO.limiteReagendamentos,
    });
    expect((await listar(token))[0]).toMatchObject({ podeReagendar: false, pedidoEnviado: false });

    expect((await pedir(token, agendamentoId)).statusCode).toBe(200);
    expect((await pedir(token, agendamentoId)).statusCode).toBe(200);
    const avisos = await prisma.alertaInterno.findMany({
      where: { onboardingId, tipo: 'pedido_reagendamento' },
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.detalhe).toBe('reunião: Vou viajar nessa semana');
    expect((await listar(token))[0]?.pedidoEnviado).toBe(true);
  });

  it('com menos antecedência que a configurada, também pode pedir', async () => {
    const { token, agendamentoId } = await criarAgendado(sp('2026-11-16T20:00'));
    expect((await pedir(token, agendamentoId)).statusCode).toBe(200);
  });
});
