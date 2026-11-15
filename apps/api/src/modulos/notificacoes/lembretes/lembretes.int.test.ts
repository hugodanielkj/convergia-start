import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo } from '@convergia/core/base';
import { cifrarToken, gerarTokenLink } from '@convergia/core/link';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../../app.js';
import { criarBarramentoEmMemoria } from '../../../base/eventos.js';
import { criarPrisma } from '../../../base/prisma.js';
import {
  AGORA_TESTE,
  CHAVE_LINK_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../../testes/dependencias.js';
import { varrerCompromissos, varrerPendencias, type DepsLembretes } from './varrer.js';

// AGORA_TESTE = segunda, 2026-11-16, 09:00 em São Paulo (UTC-3).
const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const URL_APP = 'https://app.exemplo.com';
const MS_HORA = 60 * 60 * 1000;
const MS_DIA = 24 * MS_HORA;
const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`);
const depois = (dias: number) => new Date(AGORA_TESTE.getTime() + dias * MS_DIA);

let agenciaId: string;
let responsavelId: string;
let appAdmin: FastifyInstance;
let appMembro: FastifyInstance;

const eventos = criarBarramentoEmMemoria((erro) => {
  throw erro;
});
const deps = (chaveLink: Uint8Array | null = CHAVE_LINK_TESTE): DepsLembretes => ({
  prisma,
  eventos,
  urlApp: URL_APP,
  chaveLink,
});

type Etapa = 'formulario' | 'acessos' | 'reuniao' | 'captacao';

interface Opcoes {
  readonly concluidas?: readonly Etapa[];
  readonly status?: 'convite_enviado' | 'em_andamento' | 'pausado';
  readonly conviteEm?: Date | null;
  readonly cifrado?: boolean;
}

async function criarOnboarding(tag: string, opcoes: Opcoes = {}) {
  const cliente = await prisma.cliente.create({
    data: {
      agenciaId,
      nomeEmpresa: `Loja ${tag}`,
      nomeContato: 'Bia',
      whatsapp: '+5531999998888',
      email: `${tag}-${sufixo}@x.com`,
    },
  });
  const { token, hash } = gerarTokenLink();
  const concluidas = opcoes.concluidas ?? [];
  const o = await prisma.onboarding.create({
    data: {
      agenciaId,
      clienteId: cliente.id,
      responsavelId,
      statusGeral: opcoes.status ?? 'convite_enviado',
      etapas: {
        create: (['formulario', 'acessos', 'reuniao', 'captacao'] as const).map((tipo) => ({
          agenciaId,
          tipo,
          status: concluidas.includes(tipo) ? 'concluida' : 'pendente',
        })),
      },
      link: {
        create: {
          agenciaId,
          tokenHash: hash,
          tokenCifrado: opcoes.cifrado === false ? null : cifrarToken(token, CHAVE_LINK_TESTE),
          expiraEm: depois(14),
        },
      },
    },
  });
  const conviteEm = opcoes.conviteEm === undefined ? AGORA_TESTE : opcoes.conviteEm;
  if (conviteEm) {
    await prisma.notificacao.create({
      data: {
        agenciaId,
        onboardingId: o.id,
        tipo: 'convite',
        categoria: 'transacional',
        chave: `convite:${o.id}`,
        corpo: 'convite',
        status: 'enviada',
        enviadaEm: conviteEm,
      },
    });
  }
  return { id: o.id, token };
}

const lembretes = (onboardingId: string, tipo: string) =>
  prisma.notificacao.findMany({
    where: { onboardingId, tipo },
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
  const membroId = (
    await prisma.usuario.create({
      data: { agenciaId, nome: 'Rui', email: `rui-${sufixo}@x.com`, papel: 'membro' },
    })
  ).id;
  const construir = (id: string, papel: 'admin' | 'membro') =>
    construirApp(
      { LOG_LEVEL: 'silent' },
      dependenciasDeTeste({
        prisma,
        relogio: relogioFixo(AGORA_TESTE),
        resolverSessao: () => Promise.resolve(usuarioTeste({ agenciaId, id, papel })),
      }),
    );
  appAdmin = construir(responsavelId, 'admin');
  appMembro = construir(membroId, 'membro');
  await Promise.all([appAdmin.ready(), appMembro.ready()]);
});

afterAll(async () => {
  await Promise.all([appAdmin.close(), appMembro.close()]);
  await prisma.agencia.deleteMany({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('RN-56 lembretes de pendência', () => {
  it('nada antes do D+1; no D+1 sai um lembrete com o que falta, o link e a janela', async () => {
    const { id, token } = await criarOnboarding('d1', { concluidas: ['formulario'] });
    await varrerPendencias(deps(), new Date(depois(1).getTime() - 60_000));
    expect(await lembretes(id, 'lembrete_pendencia')).toHaveLength(0);

    await varrerPendencias(deps(), depois(1));
    const [l] = await lembretes(id, 'lembrete_pendencia');
    expect(l?.chave).toBe(`lembrete_pendencia:${id}:1`);
    expect(l?.categoria).toBe('lembrete');
    expect(l?.respeitarJanela).toBe(true);
    expect(l?.corpo).toContain('Bia');
    expect(l?.corpo).toContain('liberar os acessos, agendar a reunião e agendar a captação');
    expect(l?.corpo).not.toContain('preencher o formulário');
    expect(l?.corpo).toContain(`${URL_APP}/o/${token}`);
    expect(l?.corpo).toContain('/parar-lembretes/');
  });

  it('não duplica e segue D+3 e D+5; esgotado o máximo, não sai mais nenhum', async () => {
    const { id } = await criarOnboarding('serie');
    await varrerPendencias(deps(), depois(1));
    await varrerPendencias(deps(), depois(2));
    expect(await lembretes(id, 'lembrete_pendencia')).toHaveLength(1);
    await varrerPendencias(deps(), depois(3));
    await varrerPendencias(deps(), depois(5));
    await varrerPendencias(deps(), depois(20));
    const todos = await lembretes(id, 'lembrete_pendencia');
    expect(todos.map((l) => l.chave)).toEqual(
      [1, 2, 3].map((n) => `lembrete_pendencia:${id}:${String(n)}`),
    );
  });

  it('se o sistema ficou parado, manda só o mais recente', async () => {
    const { id } = await criarOnboarding('parado');
    await varrerPendencias(deps(), depois(4));
    expect((await lembretes(id, 'lembrete_pendencia')).map((l) => l.chave)).toEqual([
      `lembrete_pendencia:${id}:2`,
    ]);
  });

  it('sem etapa pendente, sem convite enviado, pausado ou sem o link cifrado: nada', async () => {
    const feito = await criarOnboarding('feito', {
      concluidas: ['formulario', 'acessos', 'reuniao', 'captacao'],
      status: 'em_andamento',
    });
    const semConvite = await criarOnboarding('sem-convite', { conviteEm: null });
    const pausado = await criarOnboarding('pausado', { status: 'pausado' });
    const semCifra = await criarOnboarding('sem-cifra', { cifrado: false });
    const semChave = await criarOnboarding('sem-chave');
    await varrerPendencias(deps(), depois(1));
    await varrerPendencias(deps(null), depois(1));
    for (const o of [feito, semConvite, pausado, semCifra]) {
      expect(await lembretes(o.id, 'lembrete_pendencia')).toHaveLength(0);
    }
    // Com a chave, o da agência que tem link cifrado sai normalmente.
    expect(await lembretes(semChave.id, 'lembrete_pendencia')).toHaveLength(1);
  });

  it('quem pediu para parar (opt-out) não recebe', async () => {
    const { id } = await criarOnboarding('optout');
    await prisma.preferenciaEnvio.create({
      data: {
        agenciaId,
        onboardingId: id,
        tokenOptOut: randomUUID(),
        lembretesDesativadosEm: AGORA_TESTE,
      },
    });
    await varrerPendencias(deps(), depois(1));
    expect(await lembretes(id, 'lembrete_pendencia')).toHaveLength(0);
  });
});

describe('RN-57 lembretes de compromisso', () => {
  let minuto = 0;
  async function agendar(
    onboardingId: string,
    tipo: 'reuniao' | 'captacao',
    inicio: Date,
    local?: string,
  ) {
    // Um minuto a mais por agendamento: o banco não deixa dois no mesmo horário.
    minuto += 1;
    const comeco = new Date(inicio.getTime() + minuto * 60_000);
    const a = await prisma.agendamento.create({
      data: {
        agenciaId,
        onboardingId,
        tipo,
        inicio: comeco,
        fim: new Date(comeco.getTime() + 30_000),
        criadoEm: AGORA_TESTE,
        ...(local ? { dadosCaptacao: { create: { agenciaId, local } } } : {}),
      },
    });
    return a;
  }

  it('24h e 2h antes, com tipo, data e hora no fuso da agência', async () => {
    const { id, token } = await criarOnboarding('reuniao');
    const a = await agendar(id, 'reuniao', sp('2026-11-18T14:00'));
    await varrerCompromissos(deps(), new Date(a.inicio.getTime() - 25 * MS_HORA));
    expect(await lembretes(id, 'lembrete_compromisso')).toHaveLength(0);

    await varrerCompromissos(deps(), new Date(a.inicio.getTime() - 24 * MS_HORA));
    const [primeiro] = await lembretes(id, 'lembrete_compromisso');
    expect(primeiro?.corpo).toContain('reunião da Loja reuniao em 18/11/2026 às 14:');
    expect(primeiro?.corpo).toContain(`${URL_APP}/o/${token}`);
    expect(primeiro?.respeitarJanela).toBe(true);

    await varrerCompromissos(deps(), new Date(a.inicio.getTime() - 3 * MS_HORA));
    expect(await lembretes(id, 'lembrete_compromisso')).toHaveLength(1);
    await varrerCompromissos(deps(), new Date(a.inicio.getTime() - 2 * MS_HORA));
    expect(await lembretes(id, 'lembrete_compromisso')).toHaveLength(2);
    await varrerCompromissos(deps(), new Date(a.inicio.getTime() - MS_HORA));
    expect(await lembretes(id, 'lembrete_compromisso')).toHaveLength(2);
  });

  it('o de 2h antes de uma reunião às 08h sai às 20h da véspera (antecipado, RN-59)', async () => {
    const { id } = await criarOnboarding('cedo');
    await agendar(id, 'reuniao', sp('2026-11-19T07:59'));
    await varrerCompromissos(deps(), sp('2026-11-18T08:00'));
    await varrerCompromissos(deps(), sp('2026-11-18T19:59'));
    expect(await lembretes(id, 'lembrete_compromisso')).toHaveLength(1);
    await varrerCompromissos(deps(), sp('2026-11-18T20:00'));
    const todos = await lembretes(id, 'lembrete_compromisso');
    expect(todos.map((l) => l.chave.split(':').at(-1))).toEqual(['24', '2']);
  });

  it('captação leva o local informado pelo cliente quando o template usa a variável', async () => {
    await appAdmin.inject({
      method: 'PUT',
      url: '/templates/lembrete_compromisso',
      payload: {
        texto:
          'Lembrete: {{tipo}} em {{data}} às {{hora}}, em {{local_captacao}}. {{link_onboarding}}',
      },
    });
    const { id } = await criarOnboarding('captacao');
    const a = await agendar(id, 'captacao', sp('2026-11-20T15:00'), 'Rua das Flores, 100');
    await varrerCompromissos(deps(), new Date(a.inicio.getTime() - 24 * MS_HORA));
    const [l] = await lembretes(id, 'lembrete_compromisso');
    expect(l?.corpo).toContain('captação em 20/11/2026');
    expect(l?.corpo).toContain('Rua das Flores, 100');
    await appAdmin.inject({ method: 'DELETE', url: '/templates/lembrete_compromisso' });
  });

  it('reagendado: lembretes novos para o horário novo', async () => {
    const { id } = await criarOnboarding('reagenda');
    const a = await agendar(id, 'reuniao', sp('2026-11-18T14:00'));
    await varrerCompromissos(deps(), new Date(a.inicio.getTime() - 24 * MS_HORA));
    const novoInicio = new Date(a.inicio.getTime() + 2 * MS_DIA);
    await prisma.agendamento.update({
      where: { id: a.id },
      data: {
        inicio: novoInicio,
        fim: new Date(novoInicio.getTime() + 30_000),
        status: 'reagendado',
        reagendamentos: 1,
      },
    });
    await varrerCompromissos(deps(), new Date(novoInicio.getTime() - 24 * MS_HORA));
    const chaves = (await lembretes(id, 'lembrete_compromisso')).map((l) => l.chave);
    expect(chaves).toHaveLength(2);
    expect(chaves[1]).toContain(novoInicio.toISOString());
  });

  it('cancelado, onboarding pausado ou sem link cifrado: nada', async () => {
    const cancelado = await criarOnboarding('ag-cancelado');
    const a = await agendar(cancelado.id, 'reuniao', sp('2026-11-18T14:00'));
    await prisma.agendamento.update({ where: { id: a.id }, data: { status: 'cancelado' } });
    const pausado = await criarOnboarding('ag-pausado', { status: 'pausado' });
    const b = await agendar(pausado.id, 'reuniao', sp('2026-11-18T14:00'));
    const semCifra = await criarOnboarding('ag-sem-cifra', { cifrado: false });
    await agendar(semCifra.id, 'reuniao', sp('2026-11-18T14:00'));
    await varrerCompromissos(deps(), new Date(b.inicio.getTime() - 24 * MS_HORA));
    for (const o of [cancelado, pausado, semCifra]) {
      expect(await lembretes(o.id, 'lembrete_compromisso')).toHaveLength(0);
    }
  });
});

describe('Configurações › Lembretes (RN-56, RN-57, RN-59)', () => {
  const valida = {
    lembretesPendenciaDias: [5, 1, 3, 3],
    maxLembretesPendencia: 2,
    lembretesCompromissoHoras: [2, 24],
    janelaEnvioInicio: '09:00',
    janelaEnvioFim: '18:00',
    diasEnvioPermitidos: [5, 1, 2, 3, 4],
  };

  it('o Admin lê e salva; listas sem repetição e em ordem; auditado', async () => {
    const lida = await appAdmin.inject({ method: 'GET', url: '/config/lembretes' });
    expect(
      lida.json<{ config: { lembretesPendenciaDias: number[] } }>().config.lembretesPendenciaDias,
    ).toEqual(CONFIG_PADRAO.lembretesPendenciaDias);
    const salva = await appAdmin.inject({
      method: 'PUT',
      url: '/config/lembretes',
      payload: valida,
    });
    expect(salva.statusCode).toBe(200);
    const config = await prisma.configAgencia.findUniqueOrThrow({ where: { agenciaId } });
    expect(config.lembretesPendenciaDias).toEqual([1, 3, 5]);
    expect(config.diasEnvioPermitidos).toEqual([1, 2, 3, 4, 5]);
    expect(config.janelaEnvioInicio).toBe('09:00');
    expect(
      await prisma.auditoriaLog.count({ where: { agenciaId, acao: 'config.lembretes_alterada' } }),
    ).toBe(1);
    await prisma.configAgencia.update({ where: { agenciaId }, data: { ...CONFIG_PADRAO } });
  });

  it('recusa janela impossível (RN-59) e valores fora dos limites', async () => {
    const fimAntes = await appAdmin.inject({
      method: 'PUT',
      url: '/config/lembretes',
      payload: { ...valida, janelaEnvioFim: '08:00' },
    });
    expect(fimAntes.statusCode).toBe(422);
    expect(fimAntes.json()).toEqual({ erro: 'RN-59', motivo: 'fim_antes_do_inicio' });
    const semDias = await appAdmin.inject({
      method: 'PUT',
      url: '/config/lembretes',
      payload: { ...valida, diasEnvioPermitidos: [] },
    });
    expect(semDias.json()).toEqual({ erro: 'RN-59', motivo: 'sem_dias' });
    const diaZero = await appAdmin.inject({
      method: 'PUT',
      url: '/config/lembretes',
      payload: { ...valida, lembretesPendenciaDias: [0] },
    });
    expect(diaZero.statusCode).toBe(400);
  });

  it('membro não acessa (RN-03)', async () => {
    expect((await appMembro.inject({ method: 'GET', url: '/config/lembretes' })).statusCode).toBe(
      403,
    );
    expect(
      (await appMembro.inject({ method: 'PUT', url: '/config/lembretes', payload: valida }))
        .statusCode,
    ).toBe(403);
  });
});
