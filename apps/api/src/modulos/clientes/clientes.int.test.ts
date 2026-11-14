import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarPrisma } from '../../base/prisma.js';
import { URL_BANCO_TESTE, dependenciasDeTeste, usuarioTeste } from '../../testes/dependencias.js';

// Cada execução cria as próprias agências: dados isolados e seguros em paralelo.
const prisma = criarPrisma(URL_BANCO_TESTE);
let agenciaA: string;
let agenciaB: string;
let appA: FastifyInstance;
let appB: FastifyInstance;
let appSemLogin: FastifyInstance;

const sufixo = randomUUID().slice(0, 8);
const emailMaria = `maria-${sufixo}@padaria.com.br`;
const cadastroBase = {
  nomeEmpresa: 'Padaria Pão Quente',
  nomeContato: 'Maria Silva',
  whatsapp: '(31) 99999-8888',
  email: emailMaria.toUpperCase(),
};

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
  const deps = dependenciasDeTeste({ prisma, resolverSessao: () => Promise.resolve(usuario) });
  return construirApp({ LOG_LEVEL: 'silent' }, deps);
}

beforeAll(async () => {
  agenciaA = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  agenciaB = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  appA = construir(usuarioTeste({ agenciaId: agenciaA, id: 'usuario-a' }));
  appB = construir(usuarioTeste({ agenciaId: agenciaB, id: 'usuario-b' }));
  appSemLogin = construir(null);
  await Promise.all([appA.ready(), appB.ready(), appSemLogin.ready()]);
});

afterAll(async () => {
  await Promise.all([appA.close(), appB.close(), appSemLogin.close()]);
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaA, agenciaB] } } });
  await prisma.$disconnect();
});

describe('S1-3 exige usuário logado', () => {
  it('recusa cadastro e listagem sem sessão', async () => {
    const cadastro = await appSemLogin.inject({
      method: 'POST',
      url: '/clientes',
      payload: cadastroBase,
    });
    const lista = await appSemLogin.inject({ method: 'GET', url: '/clientes' });
    expect(cadastro.statusCode).toBe(401);
    expect(lista.statusCode).toBe(401);
  });
});

describe('RN-04 e RN-05 cadastro de cliente', () => {
  it('cria o cliente com canais normalizados e audita a criação (RN-77)', async () => {
    const resposta = await appA.inject({ method: 'POST', url: '/clientes', payload: cadastroBase });
    expect(resposta.statusCode).toBe(201);
    const { cliente } = resposta.json<{ cliente: { id: string } }>();
    expect(cliente).toMatchObject({
      nomeEmpresa: 'Padaria Pão Quente',
      nomeContato: 'Maria Silva',
      whatsapp: '+5531999998888',
      email: emailMaria,
    });

    const auditoria = await prisma.auditoriaLog.findMany({
      where: { agenciaId: agenciaA, entidade: 'Cliente', entidadeId: cliente.id },
    });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({ ator: 'usuario:usuario-a', acao: 'cliente.criado' });
    expect(JSON.stringify(auditoria[0]?.dados)).not.toContain('99999');
  });

  it('devolve todos os erros de validação com a regra violada', async () => {
    const resposta = await appA.inject({
      method: 'POST',
      url: '/clientes',
      payload: { nomeEmpresa: '', nomeContato: 'Ana', whatsapp: '(20) 99999-8888' },
    });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json()).toEqual({
      erro: 'CADASTRO_INVALIDO',
      erros: [
        { campo: 'nomeEmpresa', codigo: 'obrigatorio', regra: 'RN-04' },
        { campo: 'whatsapp', codigo: 'ddd_invalido', regra: 'RN-05' },
      ],
    });
  });

  it('exige WhatsApp ou e-mail', async () => {
    const resposta = await appA.inject({
      method: 'POST',
      url: '/clientes',
      payload: { nomeEmpresa: 'Loja', nomeContato: 'Ana' },
    });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json<{ erros: unknown[] }>().erros).toEqual([
      { campo: 'contato', codigo: 'contato_obrigatorio', regra: 'RN-04' },
    ]);
  });

  it('aceita campos nulos vindos do formulário', async () => {
    const resposta = await appA.inject({
      method: 'POST',
      url: '/clientes',
      payload: {
        nomeEmpresa: 'Café',
        nomeContato: 'Luiz',
        whatsapp: null,
        email: `luiz-${sufixo}@cafe.com`,
      },
    });
    expect(resposta.statusCode).toBe(201);
  });

  it('rejeita corpo com formato inesperado', async () => {
    const resposta = await appA.inject({
      method: 'POST',
      url: '/clientes',
      payload: { nomeEmpresa: 123, nomeContato: ['x'] },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json<{ erro: string }>().erro).toBe('VALIDACAO');
  });
});

describe('RN-07 alerta de cadastro duplicado', () => {
  it('alerta antes de criar quando o e-mail ou o WhatsApp já existem, sem gravar', async () => {
    const antes = await prisma.cliente.count({ where: { agenciaId: agenciaA } });
    const resposta = await appA.inject({
      method: 'POST',
      url: '/clientes',
      payload: {
        nomeEmpresa: 'Outra Padaria',
        nomeContato: 'Maria',
        whatsapp: '+55 31 99999 8888',
        email: emailMaria,
      },
    });
    expect(resposta.statusCode).toBe(409);
    expect(resposta.json()).toMatchObject({
      erro: 'RN-07',
      duplicidades: [{ nomeEmpresa: 'Padaria Pão Quente', motivos: ['whatsapp', 'email'] }],
    });
    expect(await prisma.cliente.count({ where: { agenciaId: agenciaA } })).toBe(antes);
  });

  it('cria mesmo assim quando o usuário confirma, e registra a confirmação na auditoria', async () => {
    const resposta = await appA.inject({
      method: 'POST',
      url: '/clientes',
      payload: { ...cadastroBase, nomeEmpresa: 'Padaria Filial', confirmarDuplicidade: true },
    });
    expect(resposta.statusCode).toBe(201);
    const { cliente } = resposta.json<{ cliente: { id: string } }>();
    const log = await prisma.auditoriaLog.findFirstOrThrow({
      where: { agenciaId: agenciaA, entidadeId: cliente.id },
    });
    expect(log.dados).toMatchObject({ duplicidadeConfirmada: true });
  });

  it('não confunde clientes de agências diferentes (RN-75)', async () => {
    const resposta = await appB.inject({ method: 'POST', url: '/clientes', payload: cadastroBase });
    expect(resposta.statusCode).toBe(201);
  });
});

describe('lista de clientes', () => {
  it('traz só os clientes da própria agência, do mais novo para o mais antigo', async () => {
    const resposta = await appA.inject({ method: 'GET', url: '/clientes' });
    expect(resposta.statusCode).toBe(200);
    const { clientes } = resposta.json<{ clientes: { nomeEmpresa: string }[] }>();
    expect(clientes.map((c) => c.nomeEmpresa)).toEqual([
      'Padaria Filial',
      'Café',
      'Padaria Pão Quente',
    ]);
  });

  it('não mostra clientes de outra agência', async () => {
    const resposta = await appB.inject({ method: 'GET', url: '/clientes' });
    const { clientes } = resposta.json<{ clientes: unknown[] }>();
    expect(clientes).toHaveLength(1);
  });
});
