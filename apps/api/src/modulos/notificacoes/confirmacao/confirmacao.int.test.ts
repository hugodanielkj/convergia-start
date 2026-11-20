import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../../app.js';
import { criarBarramentoEmMemoria } from '../../../base/eventos.js';
import { criarPrisma } from '../../../base/prisma.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../../testes/dependencias.js';

// AGORA_TESTE = segunda, 2026-11-16, 09:00 em São Paulo. Datas fixas em São Paulo (UTC-3).
const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`);
const MS_HORA = 3_600_000;

let agenciaId: string;
let responsavelId: string;
let app: FastifyInstance;
const eventos = criarBarramentoEmMemoria((erro) => {
  throw erro;
});

type Etapa = 'formulario' | 'acessos' | 'reuniao' | 'captacao';

async function criarOnboarding(concluidas: readonly Etapa[] = ['formulario', 'acessos']) {
  const cliente = await prisma.cliente.create({
    data: {
      agenciaId,
      nomeEmpresa: `Loja ${randomUUID().slice(0, 6)}`,
      nomeContato: 'Bia',
      whatsapp: '+5531999998888',
    },
  });
  return prisma.onboarding.create({
    data: {
      agenciaId,
      clienteId: cliente.id,
      responsavelId,
      statusGeral: 'em_andamento',
      etapas: {
        create: (['formulario', 'acessos', 'reuniao', 'captacao'] as const).map((tipo) => ({
          agenciaId,
          tipo,
          status: concluidas.includes(tipo) ? 'concluida' : 'pendente',
        })),
      },
    },
  });
}

async function agendar(onboardingId: string, tipo: 'reuniao' | 'captacao', inicio: Date) {
  const a = await prisma.agendamento.create({
    data: {
      agenciaId,
      onboardingId,
      tipo,
      inicio,
      fim: new Date(inicio.getTime() + MS_HORA),
      ...(tipo === 'captacao'
        ? { dadosCaptacao: { create: { agenciaId, local: 'Rua das Flores, 100' } } }
        : {}),
    },
  });
  await eventos.publicar({
    tipo: 'agendamento.criado',
    agenciaId,
    ocorridoEm: AGORA_TESTE,
    dados: {
      agendamentoId: a.id,
      onboardingId,
      tipo,
      inicio: a.inicio.toISOString(),
      fim: a.fim.toISOString(),
    },
  });
  return a;
}

const statusEtapa = async (onboardingId: string, tipo: Etapa) =>
  (await prisma.etapaOnboarding.findFirstOrThrow({ where: { onboardingId, tipo } })).status;

const confirmacoes = (onboardingId: string) =>
  prisma.notificacao.findMany({
    where: { onboardingId, tipo: 'confirmacao_prazo' },
    orderBy: { criadoEm: 'asc' },
  });

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `Agência ${sufixo}` } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  responsavelId = (
    await prisma.usuario.create({
      data: { agenciaId, nome: 'Ana', email: `ana-${sufixo}@x.com`, papel: 'admin' },
    })
  ).id;
  app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      eventos,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuarioTeste({ agenciaId, id: responsavelId })),
    }),
  );
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.agencia.deleteMany({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('etapa reunião/captação concluída ao agendar (2026-11-19)', () => {
  it('agendar a reunião conclui a etapa; cancelar volta a pendente', async () => {
    const o = await criarOnboarding();
    const a = await agendar(o.id, 'reuniao', sp('2026-11-18T09:00'));
    expect(await statusEtapa(o.id, 'reuniao')).toBe('concluida');

    await prisma.agendamento.update({ where: { id: a.id }, data: { status: 'cancelado' } });
    await eventos.publicar({
      tipo: 'agendamento.cancelado',
      agenciaId,
      ocorridoEm: AGORA_TESTE,
      dados: { agendamentoId: a.id, onboardingId: o.id, tipo: 'reuniao' },
    });
    expect(await statusEtapa(o.id, 'reuniao')).toBe('pendente');
  });
});

describe('seção 12, critério 1: as quatro etapas concluídas', () => {
  it('a agência recebe o aviso de conclusão e o cliente, a confirmação com datas e prazo', async () => {
    const o = await criarOnboarding();
    await agendar(o.id, 'reuniao', sp('2026-11-18T14:00'));
    expect(await confirmacoes(o.id)).toHaveLength(0);
    await agendar(o.id, 'captacao', sp('2026-11-24T10:00'));

    expect(await statusEtapa(o.id, 'captacao')).toBe('concluida');
    const aviso = await prisma.alertaInterno.findFirst({
      where: { onboardingId: o.id, tipo: 'concluiu' },
    });
    expect(aviso).not.toBeNull();

    const prazo = await prisma.prazoLiberacao.findUniqueOrThrow({ where: { onboardingId: o.id } });
    const dataPrazo = prazo.data.toISOString().slice(0, 10).split('-').reverse().join('/');
    const [confirmacao, ...outras] = await confirmacoes(o.id);
    expect(outras).toHaveLength(0);
    expect(confirmacao?.corpo).toContain('Reunião: 18/11/2026 às 14:00');
    expect(confirmacao?.corpo).toContain('Captação: 24/11/2026 às 10:00 (Rua das Flores, 100)');
    expect(confirmacao?.corpo).toContain(dataPrazo);
  });

  it('captação remarcada no mesmo dia gera confirmação nova; sem mudança, nada repete', async () => {
    const o = await criarOnboarding();
    await agendar(o.id, 'reuniao', sp('2026-11-18T16:00'));
    const c = await agendar(o.id, 'captacao', sp('2026-11-25T10:00'));
    expect(await confirmacoes(o.id)).toHaveLength(1);

    const novoInicio = sp('2026-11-25T15:00');
    await prisma.agendamento.update({
      where: { id: c.id },
      data: {
        inicio: novoInicio,
        fim: new Date(novoInicio.getTime() + MS_HORA),
        status: 'reagendado',
      },
    });
    await eventos.publicar({
      tipo: 'agendamento.reagendado',
      agenciaId,
      ocorridoEm: AGORA_TESTE,
      dados: {
        agendamentoId: c.id,
        onboardingId: o.id,
        tipo: 'captacao',
        inicioAnterior: c.inicio.toISOString(),
        inicio: novoInicio.toISOString(),
        fim: new Date(novoInicio.getTime() + MS_HORA).toISOString(),
      },
    });
    const depois = await confirmacoes(o.id);
    expect(depois).toHaveLength(2);
    expect(depois[1]?.corpo).toContain('25/11/2026 às 15:00');

    await eventos.publicar({
      tipo: 'onboarding.etapas_mudaram',
      agenciaId,
      ocorridoEm: AGORA_TESTE,
      dados: { onboardingId: o.id, ator: 'sistema' },
    });
    expect(await confirmacoes(o.id)).toHaveLength(2);
  });

  it('faltando etapa, não há confirmação nem aviso de conclusão', async () => {
    const o = await criarOnboarding(['formulario']);
    await agendar(o.id, 'reuniao', sp('2026-11-19T09:00'));
    await agendar(o.id, 'captacao', sp('2026-11-26T10:00'));
    expect(await confirmacoes(o.id)).toHaveLength(0);
    expect(
      await prisma.alertaInterno.count({ where: { onboardingId: o.id, tipo: 'concluiu' } }),
    ).toBe(0);
  });
});
