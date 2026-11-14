import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo } from '@convergia/core/base';
import { TERMO_ATUAL } from '@convergia/core/consentimento';
import { gerarTokenLink } from '@convergia/core/link';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarPrisma } from '../../base/prisma.js';
import { AGORA_TESTE, URL_BANCO_TESTE, dependenciasDeTeste } from '../../testes/dependencias.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const MS_DIA = 24 * 60 * 60 * 1000;
let agenciaId: string;
let app: FastifyInstance;

async function criarOnboarding(
  tag: string,
  opcoes: {
    status?: 'criado' | 'convite_enviado' | 'em_andamento' | 'cancelado';
    expiraEm?: Date;
  } = {},
) {
  const { token, hash } = gerarTokenLink();
  const usuario = await prisma.usuario.findFirstOrThrow({ where: { agenciaId } });
  const cliente = await prisma.cliente.create({
    data: { agenciaId, nomeEmpresa: `Empresa ${tag}`, nomeContato: 'C', email: `${tag}@x.com` },
  });
  const onboarding = await prisma.onboarding.create({
    data: {
      agenciaId,
      clienteId: cliente.id,
      responsavelId: usuario.id,
      statusGeral: opcoes.status ?? 'criado',
      link: {
        create: {
          agenciaId,
          tokenHash: hash,
          expiraEm: opcoes.expiraEm ?? new Date(AGORA_TESTE.getTime() + 14 * MS_DIA),
        },
      },
    },
  });
  return { token, onboardingId: onboarding.id };
}

const abrir = (token: string) =>
  app.inject({ method: 'POST', url: `/publico/onboardings/${token}/abrir` });
const termo = (token: string) =>
  app.inject({ method: 'GET', url: `/publico/onboardings/${token}/consentimento` });
const aceitar = (token: string, versao: string) =>
  app.inject({
    method: 'POST',
    url: `/publico/onboardings/${token}/consentimento`,
    payload: { versao },
  });

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  await prisma.usuario.create({
    data: { agenciaId, nome: 'Admin', email: `admin-${sufixo}@ag.com`, papel: 'admin' },
  });
  app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({ prisma, relogio: relogioFixo(AGORA_TESTE) }),
  );
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.agencia.delete({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('RN-50 primeira abertura do link', () => {
  it('põe o onboarding em andamento e registra data e hora uma única vez', async () => {
    const { token, onboardingId } = await criarOnboarding('a');
    const primeira = await abrir(token);
    expect(primeira.statusCode).toBe(200);
    expect(primeira.json()).toEqual({ primeiroAcesso: true });

    const onboarding = await prisma.onboarding.findUniqueOrThrow({ where: { id: onboardingId } });
    expect(onboarding.statusGeral).toBe('em_andamento');
    const registro = await prisma.primeiroAcesso.findUniqueOrThrow({ where: { onboardingId } });
    expect(registro.em).toEqual(AGORA_TESTE);

    const segunda = await abrir(token);
    expect(segunda.json()).toEqual({ primeiroAcesso: false });
    expect(await prisma.primeiroAcesso.count({ where: { onboardingId } })).toBe(1);
  });

  it('convite_enviado também passa a em_andamento; outros status não mudam', async () => {
    const convite = await criarOnboarding('b', { status: 'convite_enviado' });
    await abrir(convite.token);
    expect(
      (await prisma.onboarding.findUniqueOrThrow({ where: { id: convite.onboardingId } }))
        .statusGeral,
    ).toBe('em_andamento');
  });

  it('abrir várias vezes ao mesmo tempo conta só uma', async () => {
    const { token, onboardingId } = await criarOnboarding('c');
    const respostas = await Promise.all([abrir(token), abrir(token), abrir(token)]);
    expect(
      respostas.filter((r) => r.json<{ primeiroAcesso: boolean }>().primeiroAcesso),
    ).toHaveLength(1);
    expect(await prisma.primeiroAcesso.count({ where: { onboardingId } })).toBe(1);
  });

  it('audita o primeiro acesso como ação do cliente (RN-77)', async () => {
    const { token, onboardingId } = await criarOnboarding('d');
    await abrir(token);
    const log = await prisma.auditoriaLog.findMany({
      where: { agenciaId, acao: 'onboarding.primeiro_acesso', entidadeId: onboardingId },
    });
    expect(log).toHaveLength(1);
    expect(log[0]?.ator).toBe(`cliente:${onboardingId}`);
  });

  it('link inválido, expirado ou cancelado não registra nada', async () => {
    expect((await abrir('nao-existe')).statusCode).toBe(404);

    const expirado = await criarOnboarding('e', {
      expiraEm: new Date(AGORA_TESTE.getTime() - 1000),
    });
    expect((await abrir(expirado.token)).statusCode).toBe(410);
    expect(
      await prisma.primeiroAcesso.count({ where: { onboardingId: expirado.onboardingId } }),
    ).toBe(0);

    const cancelado = await criarOnboarding('f', { status: 'cancelado' });
    expect((await abrir(cancelado.token)).statusCode).toBe(404);
  });
});

describe('RN-72 consentimento do cliente', () => {
  it('mostra o termo vigente e que ainda não foi aceito', async () => {
    const { token } = await criarOnboarding('g');
    const r = await termo(token);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      termo: { versao: TERMO_ATUAL.versao, texto: TERMO_ATUAL.texto },
      aceitoEm: null,
    });
  });

  it('registra data, hora e versão do termo ao aceitar, e audita', async () => {
    const { token, onboardingId } = await criarOnboarding('h');
    const r = await aceitar(token, TERMO_ATUAL.versao);
    expect(r.statusCode).toBe(201);

    const registro = await prisma.consentimentoCliente.findFirstOrThrow({
      where: { onboardingId },
    });
    expect(registro).toMatchObject({ versaoTermo: TERMO_ATUAL.versao, aceitoEm: AGORA_TESTE });
    expect((await termo(token)).json<{ aceitoEm: string }>().aceitoEm).toBe(
      AGORA_TESTE.toISOString(),
    );

    const log = await prisma.auditoriaLog.findMany({
      where: { agenciaId, acao: 'consentimento.aceito', entidadeId: onboardingId },
    });
    expect(log).toHaveLength(1);
  });

  it('aceitar de novo não duplica nem muda a data original', async () => {
    const { token, onboardingId } = await criarOnboarding('i');
    await aceitar(token, TERMO_ATUAL.versao);
    const repetido = await aceitar(token, TERMO_ATUAL.versao);
    expect(repetido.statusCode).toBe(200);
    expect(await prisma.consentimentoCliente.count({ where: { onboardingId } })).toBe(1);
  });

  it('recusa aceite de versão que não é a vigente', async () => {
    const { token, onboardingId } = await criarOnboarding('j');
    const r = await aceitar(token, '1999-01-01');
    expect(r.statusCode).toBe(409);
    expect(r.json<{ erro: string }>().erro).toBe('TERMO_DESATUALIZADO');
    expect(await prisma.consentimentoCliente.count({ where: { onboardingId } })).toBe(0);
  });

  it('link inválido ou expirado não aceita nem mostra o termo', async () => {
    expect((await termo('nao-existe')).statusCode).toBe(404);
    expect((await aceitar('nao-existe', TERMO_ATUAL.versao)).statusCode).toBe(404);
    const expirado = await criarOnboarding('k', {
      expiraEm: new Date(AGORA_TESTE.getTime() - 1000),
    });
    expect((await aceitar(expirado.token, TERMO_ATUAL.versao)).statusCode).toBe(410);
  });
});
