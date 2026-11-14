import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import { hashToken } from '@convergia/core/link';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarPrisma } from '../../base/prisma.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../testes/dependencias.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const MS_DIA = 24 * 60 * 60 * 1000;
const apps: FastifyInstance[] = [];
let agenciaA: string;
let agenciaB: string;
let adminA: string;
let responsavelA: string;
let outroMembroA: string;
let appAdmin: FastifyInstance;
let appResponsavel: FastifyInstance;
let appOutroMembro: FastifyInstance;
let appAdminB: FastifyInstance;
let appPublico: FastifyInstance;

function construir(usuario: UsuarioAutenticado | null, agora = AGORA_TESTE): FastifyInstance {
  const deps = dependenciasDeTeste({
    prisma,
    relogio: relogioFixo(agora),
    resolverSessao: () => Promise.resolve(usuario),
  });
  const app = construirApp({ LOG_LEVEL: 'silent' }, deps);
  apps.push(app);
  return app;
}

async function criarAgencia(nome: string, comConfig = true) {
  const agenciaId = (await prisma.agencia.create({ data: { nome } })).id;
  if (comConfig) await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const usuario = (papel: 'admin' | 'membro', apelido: string) =>
    prisma.usuario.create({
      data: { agenciaId, nome: apelido, email: `${apelido}-${nome}-${sufixo}@ag.com`, papel },
    });
  return { agenciaId, usuario };
}

beforeAll(async () => {
  const a = await criarAgencia('A');
  const b = await criarAgencia('B');
  agenciaA = a.agenciaId;
  agenciaB = b.agenciaId;
  adminA = (await a.usuario('admin', 'admin')).id;
  responsavelA = (await a.usuario('membro', 'responsavel')).id;
  outroMembroA = (await a.usuario('membro', 'outro')).id;
  const adminB = (await b.usuario('admin', 'admin')).id;

  appAdmin = construir(usuarioTeste({ agenciaId: agenciaA, id: adminA }));
  appResponsavel = construir(
    usuarioTeste({ agenciaId: agenciaA, id: responsavelA, papel: 'membro' }),
  );
  appOutroMembro = construir(
    usuarioTeste({ agenciaId: agenciaA, id: outroMembroA, papel: 'membro' }),
  );
  appAdminB = construir(usuarioTeste({ agenciaId: agenciaB, id: adminB }));
  appPublico = construir(null);
  await Promise.all(apps.map((app) => app.ready()));
});

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaA, agenciaB] } } });
  await prisma.$disconnect();
});

interface Cadastro {
  clienteId: string;
  onboardingId: string;
  token: string;
  caminho: string;
  expiraEm: string;
}

async function cadastrar(nome: string, app = appAdmin, extra: Record<string, unknown> = {}) {
  const resposta = await app.inject({
    method: 'POST',
    url: '/clientes',
    payload: {
      nomeEmpresa: nome,
      nomeContato: 'Contato',
      email: `${nome.toLowerCase().replaceAll(' ', '-')}-${sufixo}@teste.com`,
      ...extra,
    },
  });
  expect(resposta.statusCode).toBe(201);
  const corpo = resposta.json<{
    cliente: { id: string; onboarding: { id: string } };
    link: { token: string; caminho: string; expiraEm: string };
  }>();
  return {
    clienteId: corpo.cliente.id,
    onboardingId: corpo.cliente.onboarding.id,
    ...corpo.link,
  } satisfies Cadastro;
}

const consultar = (token: string, app = appPublico) =>
  app.inject({ method: 'GET', url: `/publico/onboardings/${token}` });

describe('RN-10 e RN-11 link emitido junto com o onboarding', () => {
  it('devolve o token uma vez, com a validade configurada pela agência', async () => {
    const link = await cadastrar('Loja Link');
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(link.caminho).toBe(`/o/${link.token}`);
    expect(link.expiraEm).toBe(new Date(AGORA_TESTE.getTime() + 14 * MS_DIA).toISOString());
  });

  it('guarda só o hash SHA-256 do token (D-13)', async () => {
    const link = await cadastrar('Loja Hash');
    const gravado = await prisma.linkOnboarding.findUniqueOrThrow({
      where: { onboardingId: link.onboardingId },
    });
    expect(gravado.tokenHash).toBe(hashToken(link.token));
    expect(JSON.stringify(gravado)).not.toContain(link.token);
  });

  it('usa a validade da configuração, sem valor fixo no código', async () => {
    const c = await criarAgencia('Curta');
    await prisma.configAgencia.update({
      where: { agenciaId: c.agenciaId },
      data: { validadeLinkDias: 3 },
    });
    const admin = await c.usuario('admin', 'admin');
    const app = construir(usuarioTeste({ agenciaId: c.agenciaId, id: admin.id }));
    const link = await cadastrar('Loja Curta', app);
    await app.close();
    expect(link.expiraEm).toBe(new Date(AGORA_TESTE.getTime() + 3 * MS_DIA).toISOString());
    await prisma.agencia.delete({ where: { id: c.agenciaId } });
  });

  it('sem configuração da agência não há como calcular a validade', async () => {
    const d = await criarAgencia('SemConfig', false);
    const admin = await d.usuario('admin', 'admin');
    const app = construir(usuarioTeste({ agenciaId: d.agenciaId, id: admin.id }));
    const resposta = await app.inject({
      method: 'POST',
      url: '/clientes',
      payload: { nomeEmpresa: 'X', nomeContato: 'Y', email: `x-${sufixo}@teste.com` },
    });
    await app.close();
    expect(resposta.statusCode).toBe(404);
    expect(await prisma.cliente.count({ where: { agenciaId: d.agenciaId } })).toBe(0);
    await prisma.agencia.delete({ where: { id: d.agenciaId } });
  });

  it('um novo onboarding de cliente existente também recebe link', async () => {
    const { clienteId, onboardingId } = await cadastrar('Loja Retorno');
    await prisma.onboarding.update({
      where: { id: onboardingId },
      data: { statusGeral: 'concluido' },
    });
    const resposta = await appAdmin.inject({
      method: 'POST',
      url: `/clientes/${clienteId}/onboardings`,
      payload: {},
    });
    expect(resposta.statusCode).toBe(201);
    const { link } = resposta.json<{ link: { token: string } }>();
    expect((await consultar(link.token)).statusCode).toBe(200);
  });
});

describe('RN-13 consulta pública pelo token', () => {
  it('mostra só o onboarding do link, sem ids nem dados da agência', async () => {
    const { token } = await cadastrar('Loja Publica');
    const resposta = await consultar(token);
    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['cache-control']).toBe('no-store');
    expect(resposta.json()).toEqual({
      onboarding: {
        empresa: 'Loja Publica',
        statusGeral: 'criado',
        etapas: [
          { tipo: 'formulario', status: 'pendente' },
          { tipo: 'acessos', status: 'pendente' },
          { tipo: 'reuniao', status: 'pendente' },
          { tipo: 'captacao', status: 'pendente' },
        ],
      },
    });
  });

  it('cada link mostra apenas o seu cliente, mesmo em agências diferentes', async () => {
    const um = await cadastrar('Cliente Um');
    const dois = await cadastrar('Cliente Dois', appAdminB);
    expect(
      (await consultar(um.token)).json<{ onboarding: { empresa: string } }>().onboarding.empresa,
    ).toBe('Cliente Um');
    expect(
      (await consultar(dois.token)).json<{ onboarding: { empresa: string } }>().onboarding.empresa,
    ).toBe('Cliente Dois');
  });

  it('token errado ou malformado dá a mesma resposta, sem revelar nada', async () => {
    const { token } = await cadastrar('Loja Segredo');
    const adulterado = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    const respostas = await Promise.all(
      [adulterado, 'lixo', 'x'.repeat(99)].map((t) => consultar(t)),
    );
    for (const resposta of respostas) {
      expect(resposta.statusCode).toBe(404);
      expect(resposta.json()).toEqual({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
    }
  });

  it('link expirado responde 410 para a tela amigável (RN-11)', async () => {
    const { token } = await cadastrar('Loja Expira');
    const quaseExpirado = construir(null, new Date(AGORA_TESTE.getTime() + 14 * MS_DIA - 1));
    const expirado = construir(null, new Date(AGORA_TESTE.getTime() + 14 * MS_DIA));
    expect((await consultar(token, quaseExpirado)).statusCode).toBe(200);
    const resposta = await consultar(token, expirado);
    expect(resposta.statusCode).toBe(410);
    expect(resposta.json<{ erro: string }>().erro).toBe('LINK_EXPIRADO');
  });

  it('onboarding cancelado invalida o link e não se distingue de link inexistente (RN-53)', async () => {
    const { token, onboardingId } = await cadastrar('Loja Cancelada');
    await prisma.onboarding.update({
      where: { id: onboardingId },
      data: { statusGeral: 'cancelado' },
    });
    const resposta = await consultar(token);
    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({ erro: 'LINK_INVALIDO', mensagem: 'Link inválido' });
  });
});

describe('RN-12 regenerar o link', () => {
  const regenerar = (app: FastifyInstance, onboardingId: string) =>
    app.inject({ method: 'POST', url: `/onboardings/${onboardingId}/link/regenerar` });

  it('invalida o token anterior na hora e o novo passa a valer', async () => {
    const antigo = await cadastrar('Loja Regera');
    const resposta = await regenerar(appAdmin, antigo.onboardingId);
    expect(resposta.statusCode).toBe(200);
    const { link } = resposta.json<{ link: { token: string; caminho: string } }>();

    expect(link.token).not.toBe(antigo.token);
    expect(link.caminho).toBe(`/o/${link.token}`);
    expect((await consultar(antigo.token)).statusCode).toBe(404);
    expect((await consultar(link.token)).statusCode).toBe(200);
    expect(
      await prisma.linkOnboarding.count({ where: { onboardingId: antigo.onboardingId } }),
    ).toBe(1);
  });

  it('renova a validade e registra a auditoria (RN-77)', async () => {
    const antigo = await cadastrar('Loja Audita');
    const depois = construir(
      usuarioTeste({ agenciaId: agenciaA, id: adminA }),
      new Date(AGORA_TESTE.getTime() + 10 * MS_DIA),
    );
    const { link } = (await regenerar(depois, antigo.onboardingId)).json<{
      link: { expiraEm: string };
    }>();
    expect(link.expiraEm).toBe(new Date(AGORA_TESTE.getTime() + 24 * MS_DIA).toISOString());

    const auditoria = await prisma.auditoriaLog.findMany({
      where: { entidadeId: antigo.onboardingId, acao: 'link.regenerado' },
    });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]?.ator).toBe(`usuario:${adminA}`);
    const gravado = await prisma.linkOnboarding.findUniqueOrThrow({
      where: { onboardingId: antigo.onboardingId },
    });
    expect(gravado.regeneradoEm).not.toBeNull();
  });

  it('o responsável do onboarding pode regenerar', async () => {
    const { onboardingId } = await cadastrar('Loja Do Responsavel', appAdmin, {
      responsavelId: responsavelA,
    });
    expect((await regenerar(appResponsavel, onboardingId)).statusCode).toBe(200);
  });

  it('outro membro não pode (RN-02) e o link continua o mesmo', async () => {
    const { onboardingId, token } = await cadastrar('Loja Alheia', appAdmin, {
      responsavelId: responsavelA,
    });
    const resposta = await regenerar(appOutroMembro, onboardingId);
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json<{ erro: string }>().erro).toBe('RN-02');
    expect((await consultar(token)).statusCode).toBe(200);
  });

  it('não alcança onboarding de outra agência (RN-75)', async () => {
    const { onboardingId, token } = await cadastrar('Loja Fechada');
    expect((await regenerar(appAdminB, onboardingId)).statusCode).toBe(404);
    expect((await consultar(token)).statusCode).toBe(200);
  });

  it.each(['concluido', 'cancelado'] as const)('recusa regenerar onboarding %s', async (status) => {
    const { onboardingId } = await cadastrar(`Loja ${status} regera`);
    await prisma.onboarding.update({ where: { id: onboardingId }, data: { statusGeral: status } });
    const resposta = await regenerar(appAdmin, onboardingId);
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json<{ erro: string }>().erro).toBe('RN-12');
  });

  it('exige usuário logado', async () => {
    expect((await regenerar(appPublico, 'qualquer')).statusCode).toBe(401);
  });
});
