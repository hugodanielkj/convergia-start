import { randomUUID } from 'node:crypto';
import {
  CONFIG_PADRAO,
  relogioFixo,
  type Canal,
  type Mensageria,
  type MensagemSaida,
  type ResultadoEnvio,
} from '@convergia/core/base';
import { ERRO_CANAL_NAO_CONFIGURADO } from '@convergia/core/envio';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../../app.js';
import { criarBarramentoEmMemoria } from '../../../base/eventos.js';
import { escopoAgencia } from '../../../base/escopo-agencia.js';
import { criarPrisma } from '../../../base/prisma.js';
import { AGORA_TESTE, URL_BANCO_TESTE, dependenciasDeTeste } from '../../../testes/dependencias.js';
import { enfileirarNotificacao, type NovaNotificacao } from './enfileirar.js';
import { processarNotificacao, processarPendentes } from './processar.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const URL_APP = 'https://app.exemplo.com';
let agenciaId: string;
let responsavelId: string;
let appPublico: FastifyInstance;

/** Mensageria roteirizada: cada canal devolve os resultados da fila, na ordem; depois, sucesso. */
class MensageriaRoteiro implements Mensageria {
  readonly enviadas: MensagemSaida[] = [];
  constructor(private readonly roteiro: Partial<Record<Canal, ResultadoEnvio[]>> = {}) {}
  enviar(m: MensagemSaida): Promise<ResultadoEnvio> {
    this.enviadas.push(m);
    const proximo = this.roteiro[m.canal]?.shift();
    return Promise.resolve(
      proximo ?? { ok: true, idExterno: `id-${String(this.enviadas.length)}` },
    );
  }
}
const temporario: ResultadoEnvio = { ok: false, erro: 'timeout', temporario: true };
const definitivo: ResultadoEnvio = { ok: false, erro: 'numero invalido', temporario: false };
const semCredencial: ResultadoEnvio = {
  ok: false,
  erro: ERRO_CANAL_NAO_CONFIGURADO,
  temporario: true,
};

const eventosPublicados: string[] = [];
const eventos = criarBarramentoEmMemoria((erro) => {
  throw erro;
});
for (const tipo of [
  'notificacao.enfileirada',
  'notificacao.enviada',
  'notificacao.falhou',
] as const) {
  eventos.assinar(tipo, (e) => {
    eventosPublicados.push(`${tipo}:${e.dados.notificacaoId}`);
    return Promise.resolve();
  });
}

async function criarOnboarding(
  tag: string,
  contatos: { whatsapp?: string | null; email?: string | null } = {},
  status: 'em_andamento' | 'pausado' = 'em_andamento',
) {
  const cliente = await prisma.cliente.create({
    data: {
      agenciaId,
      nomeEmpresa: `Loja ${tag}`,
      nomeContato: 'Bia',
      whatsapp: contatos.whatsapp === undefined ? '+5531999998888' : contatos.whatsapp,
      email: contatos.email === undefined ? `${tag}-${sufixo}@x.com` : contatos.email,
    },
  });
  const o = await prisma.onboarding.create({
    data: { agenciaId, clienteId: cliente.id, responsavelId, statusGeral: status },
  });
  return o.id;
}

const enfileirar = (onboardingId: string, parcial: Partial<NovaNotificacao> = {}) =>
  enfileirarNotificacao(
    escopoAgencia(prisma, agenciaId),
    eventos,
    URL_APP,
    {
      onboardingId,
      tipo: 'convite',
      categoria: 'transacional',
      chave: `convite:${onboardingId}:${randomUUID()}`,
      corpo: 'Olá!',
      ...parcial,
    },
    AGORA_TESTE,
  );

const ler = (id: string) => prisma.notificacao.findUniqueOrThrow({ where: { id } });
const minutos = (m: number) => new Date(AGORA_TESTE.getTime() + m * 60_000);

async function enfileirada(onboardingId: string, parcial: Partial<NovaNotificacao> = {}) {
  const r = await enfileirar(onboardingId, parcial);
  if (r.situacao !== 'enfileirada') throw new Error(r.situacao);
  return r.id;
}

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `Ag ${sufixo}` } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  responsavelId = (
    await prisma.usuario.create({
      data: { agenciaId, nome: 'Ana', email: `ana-${sufixo}@x.com`, papel: 'admin' },
    })
  ).id;
  appPublico = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({ prisma, relogio: relogioFixo(AGORA_TESTE) }),
  );
  await appPublico.ready();
});

afterAll(async () => {
  await appPublico.close();
  await prisma.agencia.deleteMany({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('RN-62 registro e envio', () => {
  it('registra a mensagem e envia pelo canal padrão da agência (WhatsApp)', async () => {
    const o = await criarOnboarding('ok');
    const id = await enfileirada(o, { assunto: 'Bem-vinda' });
    expect(eventosPublicados).toContain(`notificacao.enfileirada:${id}`);
    const m = new MensageriaRoteiro();
    expect(await processarNotificacao(prisma, m, eventos, id, AGORA_TESTE)).toBe('enviada');
    expect(m.enviadas).toEqual([
      {
        canal: 'whatsapp',
        destinatario: '+5531999998888',
        corpo: 'Olá!',
        assunto: 'Bem-vinda',
        tipo: 'convite',
      },
    ]);
    expect(await ler(id)).toMatchObject({
      status: 'enviada',
      canal: 'whatsapp',
      idExterno: 'id-1',
      totalTentativas: 1,
      enviadaEm: AGORA_TESTE,
      erro: null,
    });
    expect(eventosPublicados).toContain(`notificacao.enviada:${id}`);
  });

  it('a mesma chave nunca gera duas mensagens', async () => {
    const o = await criarOnboarding('dup');
    const chave = `convite:${o}`;
    expect((await enfileirar(o, { chave })).situacao).toBe('enfileirada');
    expect(await enfileirar(o, { chave })).toEqual({ situacao: 'duplicada' });
    expect(await prisma.notificacao.count({ where: { onboardingId: o } })).toBe(1);
  });

  it('dois workers ao mesmo tempo enviam uma vez só', async () => {
    const o = await criarOnboarding('corrida');
    const id = await enfileirada(o);
    const m = new MensageriaRoteiro();
    const r = await Promise.all([
      processarNotificacao(prisma, m, eventos, id, AGORA_TESTE),
      processarNotificacao(prisma, m, eventos, id, AGORA_TESTE),
    ]);
    expect(r.sort()).toEqual(['enviada', 'ignorada']);
    expect(m.enviadas).toHaveLength(1);
  });

  it('falha temporária espera e tenta de novo no mesmo canal', async () => {
    const o = await criarOnboarding('temp');
    const id = await enfileirada(o);
    const m = new MensageriaRoteiro({ whatsapp: [temporario] });
    expect(await processarNotificacao(prisma, m, eventos, id, AGORA_TESTE)).toBe('aguardando');
    expect(await ler(id)).toMatchObject({
      status: 'pendente',
      tentativas: 1,
      erro: 'timeout',
      proximaTentativaEm: minutos(1),
      reservadaAte: null,
    });
    // Antes da hora, a varredura não pega; depois, envia.
    await processarPendentes(prisma, m, eventos, AGORA_TESTE, 500);
    expect(await ler(id)).toMatchObject({ status: 'pendente', tentativas: 1, totalTentativas: 1 });
    expect(await processarNotificacao(prisma, m, eventos, id, minutos(1))).toBe('enviada');
    expect(await ler(id)).toMatchObject({
      status: 'enviada',
      canal: 'whatsapp',
      totalTentativas: 2,
    });
  });
});

describe('RN-60 canal alternativo', () => {
  it('erro definitivo no WhatsApp: envia pelo e-mail na hora', async () => {
    const o = await criarOnboarding('troca');
    const id = await enfileirada(o);
    const m = new MensageriaRoteiro({ whatsapp: [definitivo] });
    expect(await processarNotificacao(prisma, m, eventos, id, AGORA_TESTE)).toBe('enviada');
    expect(m.enviadas.map((e) => e.canal)).toEqual(['whatsapp', 'email']);
    expect(await ler(id)).toMatchObject({ status: 'enviada', canal: 'email', totalTentativas: 2 });
  });

  it('cliente só com e-mail recebe por e-mail', async () => {
    const o = await criarOnboarding('so-email', { whatsapp: null });
    const id = await enfileirada(o);
    const m = new MensageriaRoteiro();
    await processarNotificacao(prisma, m, eventos, id, AGORA_TESTE);
    expect(m.enviadas.map((e) => e.canal)).toEqual(['email']);
  });

  it('falhou nos dois canais: registra o erro e avisa (alerta interno da S5-4)', async () => {
    const o = await criarOnboarding('falha');
    const id = await enfileirada(o);
    const m = new MensageriaRoteiro({ whatsapp: [definitivo], email: [definitivo] });
    expect(await processarNotificacao(prisma, m, eventos, id, AGORA_TESTE)).toBe('falhou');
    expect(await ler(id)).toMatchObject({ status: 'falhou', erro: 'numero invalido' });
    expect(eventosPublicados).toContain(`notificacao.falhou:${id}`);
  });

  it('sem contato nenhum, falha sem chamar o provedor', async () => {
    const o = await criarOnboarding('sem-contato', { whatsapp: null, email: null });
    const id = await enfileirada(o);
    const m = new MensageriaRoteiro();
    expect(await processarNotificacao(prisma, m, eventos, id, AGORA_TESTE)).toBe('falhou');
    expect(m.enviadas).toHaveLength(0);
    expect(await ler(id)).toMatchObject({ erro: 'sem_contato' });
  });
});

describe('sem credenciais (decisão do PO)', () => {
  it('nenhum canal configurado: fica pendente, sem gastar tentativas, e sai quando configurar', async () => {
    const o = await criarOnboarding('sem-cred');
    const id = await enfileirada(o);
    const sem = new MensageriaRoteiro({ whatsapp: [semCredencial], email: [semCredencial] });
    expect(await processarNotificacao(prisma, sem, eventos, id, AGORA_TESTE)).toBe('aguardando');
    expect(await ler(id)).toMatchObject({
      status: 'pendente',
      tentativas: 0,
      canalIndice: 0,
      proximaTentativaEm: minutos(15),
      erro: ERRO_CANAL_NAO_CONFIGURADO,
    });
    const configurado = new MensageriaRoteiro();
    expect(await processarNotificacao(prisma, configurado, eventos, id, minutos(15))).toBe(
      'enviada',
    );
    expect(configurado.enviadas.map((e) => e.canal)).toEqual(['whatsapp']);
  });

  it('só o e-mail configurado: vai pelo e-mail', async () => {
    const o = await criarOnboarding('so-resend');
    const id = await enfileirada(o);
    const m = new MensageriaRoteiro({ whatsapp: [semCredencial] });
    expect(await processarNotificacao(prisma, m, eventos, id, AGORA_TESTE)).toBe('enviada');
    expect(await ler(id)).toMatchObject({ canal: 'email' });
  });
});

describe('RN-61 e RN-53 lembretes', () => {
  it('lembrete leva o link para parar; abrir o link não desativa; o POST desativa e cancela a fila', async () => {
    const o = await criarOnboarding('opt');
    const id = await enfileirada(o, { categoria: 'lembrete', tipo: 'lembrete_pendencia' });
    const { corpo } = await ler(id);
    const token = /parar-lembretes\/(\S+)$/.exec(corpo)?.[1] ?? '';
    expect(corpo).toContain(`${URL_APP}/parar-lembretes/`);
    expect(token).toHaveLength(43);

    const consulta = await appPublico.inject({ url: `/publico/lembretes/${token}` });
    expect(consulta.json()).toEqual({ empresa: 'Loja opt', desativado: false });
    expect(consulta.headers['cache-control']).toBe('no-store');

    const parar = await appPublico.inject({
      method: 'POST',
      url: `/publico/lembretes/${token}/parar`,
    });
    expect(parar.json()).toEqual({ desativado: true });
    expect(await ler(id)).toMatchObject({ status: 'cancelada', erro: 'opt_out' });
    expect((await appPublico.inject({ url: `/publico/lembretes/${token}` })).json()).toMatchObject({
      desativado: true,
    });
    expect(
      await prisma.auditoriaLog.count({ where: { entidadeId: o, acao: 'lembretes.desativados' } }),
    ).toBe(1);

    // Novos lembretes não entram; convite e confirmação continuam.
    expect(await enfileirar(o, { categoria: 'lembrete' })).toEqual({ situacao: 'opt_out' });
    expect((await enfileirar(o)).situacao).toBe('enfileirada');
  });

  it('o mesmo link serve para todos os lembretes do onboarding', async () => {
    const o = await criarOnboarding('mesmo-link');
    const a = await enfileirada(o, { categoria: 'lembrete' });
    const b = await enfileirada(o, { categoria: 'lembrete' });
    const fim = async (id: string) => (await ler(id)).corpo.split('/').pop();
    expect(await fim(a)).toBe(await fim(b));
  });

  it('pausado não recebe lembretes (RN-53)', async () => {
    const o = await criarOnboarding('pausado', {}, 'pausado');
    expect(await enfileirar(o, { categoria: 'lembrete' })).toEqual({ situacao: 'sem_lembretes' });
  });

  it('token desconhecido dá 404 sem revelar nada', async () => {
    expect((await appPublico.inject({ url: '/publico/lembretes/nao-existe' })).statusCode).toBe(
      404,
    );
    expect(
      (await appPublico.inject({ method: 'POST', url: '/publico/lembretes/nao-existe/parar' }))
        .statusCode,
    ).toBe(404);
  });
});
