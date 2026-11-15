import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../app.js';
import { criarPrisma } from '../../../base/prisma.js';
import {
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../../testes/dependencias.js';

// Segunda, 2026-11-09, 09:00 em São Paulo: uma semana antes do AGORA dos outros testes, para
// o worker de envio (global) destes apps não pegar mensagens de outros arquivos de teste.
const AGORA = new Date('2026-11-09T12:00:00Z');
const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const MS_HORA = 60 * 60 * 1000;
const apps: FastifyInstance[] = [];
let agenciaId: string;
let adminId: string;
let responsavelId: string;
let outroId: string;

function construir(
  usuario: Partial<UsuarioAutenticado>,
  agora = AGORA,
  chaveLink?: Uint8Array | null,
) {
  const app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(agora),
      resolverSessao: () => Promise.resolve(usuarioTeste({ agenciaId, ...usuario })),
      ...(chaveLink === undefined ? {} : { chaveLink }),
    }),
  );
  apps.push(app);
  return app;
}
const admin = (agora = AGORA) => construir({ id: adminId }, agora);
const depois = (horas: number) => new Date(AGORA.getTime() + horas * MS_HORA);

async function cadastrar(
  tag: string,
  extra: Record<string, unknown> = {},
  app: FastifyInstance | null = null,
) {
  const alvo = app ?? admin();
  await alvo.ready();
  const r = await alvo.inject({
    method: 'POST',
    url: '/clientes',
    payload: {
      nomeEmpresa: `Loja ${tag}`,
      nomeContato: 'Bia',
      email: `${tag}-${sufixo}@x.com`,
      responsavelId,
      ...extra,
    },
  });
  expect(r.statusCode).toBe(201);
  const corpo = r.json<{
    cliente: { onboarding: { id: string } };
    link: { token: string };
    convite: { enviaEm: string } | null;
  }>();
  return { id: corpo.cliente.onboarding.id, token: corpo.link.token, convite: corpo.convite };
}

const notificacoes = (onboardingId: string, tipo: string) =>
  prisma.notificacao.findMany({ where: { onboardingId, tipo }, orderBy: { criadoEm: 'asc' } });
const status = async (id: string) =>
  (await prisma.onboarding.findUniqueOrThrow({ where: { id } })).statusGeral;

async function reenviar(app: FastifyInstance, id: string, oque: 'convite' | 'lembrete') {
  await app.ready();
  return app.inject({ method: 'POST', url: `/onboardings/${id}/${oque}/reenviar` });
}

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `Ag ${sufixo}` } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const usuario = (nome: string, papel: 'admin' | 'membro') =>
    prisma.usuario.create({
      data: { agenciaId, nome, email: `${nome}-${sufixo}@x.com`, papel },
    });
  adminId = (await usuario('chefe', 'admin')).id;
  responsavelId = (await usuario('ana', 'membro')).id;
  outroId = (await usuario('rui', 'membro')).id;
});

afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await prisma.agencia.deleteMany({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('RN-09 convite automático no cadastro', () => {
  it('põe o convite na fila com o link, e o status vira convite_enviado quando ele sai', async () => {
    const app = admin();
    const { id, token, convite } = await cadastrar('auto', {}, app);
    expect(convite).toEqual({ enviaEm: AGORA.toISOString() });
    const [n] = await notificacoes(id, 'convite');
    expect(n?.chave).toBe(`convite:${id}:cadastro`);
    expect(n?.respeitarJanela).toBe(true);
    expect(n?.categoria).toBe('transacional');
    expect(n?.corpo).toContain(`/o/${token}`);
    expect(n?.corpo).toContain('Bia');
    // Outro app de teste pode ter enviado a mensagem (o worker é global e o barramento é de cada
    // app): espera sair e entrega o evento a este app, como o worker dele faria.
    const enviada = await vi.waitFor(async () => {
      const [m] = await notificacoes(id, 'convite');
      expect(m?.status).toBe('enviada');
      return m;
    });
    await app.deps.eventos.publicar({
      tipo: 'notificacao.enviada',
      agenciaId,
      ocorridoEm: AGORA,
      dados: { notificacaoId: enviada?.id ?? '', onboardingId: id, canal: 'email' },
    });
    expect(await status(id)).toBe('convite_enviado');
  });

  it('"Enviar convite depois": nada na fila e o status fica criado', async () => {
    const { id, convite } = await cadastrar('depois', { enviarConviteDepois: true });
    expect(convite).toBeNull();
    expect(await notificacoes(id, 'convite')).toHaveLength(0);
    expect(await status(id)).toBe('criado');
  });

  it('cadastro às 23h: o convite espera o próximo horário permitido (RN-59)', async () => {
    const noite = new Date('2026-11-10T02:00:00Z'); // segunda, 23h em São Paulo
    const { id, convite } = await cadastrar('noite', {}, admin(noite));
    expect(convite).toEqual({ enviaEm: '2026-11-10T11:00:00.000Z' });
    const [n] = await notificacoes(id, 'convite');
    expect(n?.respeitarJanela).toBe(true);
  });
});

describe('RN-66 reenviar convite', () => {
  it('respeita o intervalo mínimo desde o último convite e depois reenvia', async () => {
    const { id, token } = await cadastrar('reconvite');
    const cedo = await reenviar(admin(depois(23)), id, 'convite');
    expect(cedo.statusCode).toBe(422);
    expect(cedo.json<{ erro: string; mensagem: string }>()).toMatchObject({
      erro: 'RN-66',
      mensagem: expect.stringContaining('10/11/2026 às 09:00') as string,
    });
    const r = await reenviar(admin(depois(25)), id, 'convite');
    expect(r.statusCode).toBe(200);
    const todos = await notificacoes(id, 'convite');
    expect(todos).toHaveLength(2);
    expect(todos[1]?.corpo).toContain(`/o/${token}`);
    expect(
      await prisma.auditoriaLog.count({ where: { entidadeId: id, acao: 'convite.reenviado' } }),
    ).toBe(1);
  });

  it('o responsável reenvia; outro membro não (RN-02)', async () => {
    const { id } = await cadastrar('perm', { enviarConviteDepois: true });
    expect(
      (await reenviar(construir({ id: outroId, papel: 'membro' }), id, 'convite')).statusCode,
    ).toBe(403);
    expect(
      (await reenviar(construir({ id: responsavelId, papel: 'membro' }), id, 'convite')).statusCode,
    ).toBe(200);
  });

  it('sem link recuperável pede para regenerar (RN-12)', async () => {
    const semChave = construir({ id: adminId }, AGORA, null);
    const { id } = await cadastrar('sem-chave', { enviarConviteDepois: true }, semChave);
    const r = await reenviar(admin(), id, 'convite');
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erro: string }>().erro).toBe('RN-12');
  });

  it('onboarding cancelado não recebe', async () => {
    const { id } = await cadastrar('cancelado', { enviarConviteDepois: true });
    await prisma.onboarding.update({ where: { id }, data: { statusGeral: 'cancelado' } });
    expect((await reenviar(admin(), id, 'convite')).json<{ erro: string }>().erro).toBe('RN-53');
  });
});

describe('RN-66 reenviar lembrete', () => {
  it('manda o lembrete de pendência na hora, fora da contagem dos automáticos', async () => {
    const { id } = await cadastrar('relembra');
    const r = await reenviar(admin(depois(2)), id, 'lembrete');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ enviaEm: depois(2).toISOString() });
    const [n] = await notificacoes(id, 'lembrete_pendencia');
    expect(n?.chave).toMatch(new RegExp(`^lembrete_pendencia:${id}:manual:`));
    expect(n?.categoria).toBe('lembrete');
    expect(n?.corpo).toContain('preencher o formulário');
    expect((await reenviar(admin(depois(3)), id, 'lembrete')).json<{ erro: string }>().erro).toBe(
      'RN-66',
    );
  });

  it('opt-out, pausado ou sem etapa pendente: recusa com o motivo', async () => {
    const optout = await cadastrar('rel-optout', { enviarConviteDepois: true });
    await prisma.preferenciaEnvio.create({
      data: {
        agenciaId,
        onboardingId: optout.id,
        tokenOptOut: randomUUID(),
        lembretesDesativadosEm: AGORA,
      },
    });
    expect((await reenviar(admin(), optout.id, 'lembrete')).json<{ erro: string }>().erro).toBe(
      'RN-61',
    );

    const pausado = await cadastrar('rel-pausado', { enviarConviteDepois: true });
    await prisma.onboarding.update({ where: { id: pausado.id }, data: { statusGeral: 'pausado' } });
    expect((await reenviar(admin(), pausado.id, 'lembrete')).json<{ erro: string }>().erro).toBe(
      'RN-53',
    );

    const feito = await cadastrar('rel-feito', { enviarConviteDepois: true });
    await prisma.etapaOnboarding.updateMany({
      where: { onboardingId: feito.id },
      data: { status: 'concluida' },
    });
    expect((await reenviar(admin(), feito.id, 'lembrete')).json<{ erro: string }>().erro).toBe(
      'RN-56',
    );
  });
});
