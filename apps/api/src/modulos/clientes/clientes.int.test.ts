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
let appMembroA: FastifyInstance;
let adminA: string;
let membroA: string;
let adminDeB: string;

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
  // A RN-08 precisa de um Admin ativo em cada agência para ser o responsável padrão.
  adminA = (
    await prisma.usuario.create({
      data: {
        agenciaId: agenciaA,
        nome: 'Admin A',
        email: `admin-a-${sufixo}@ag.com`,
        papel: 'admin',
      },
    })
  ).id;
  membroA = (
    await prisma.usuario.create({
      data: {
        agenciaId: agenciaA,
        nome: 'Membro A',
        email: `membro-a-${sufixo}@ag.com`,
        papel: 'membro',
      },
    })
  ).id;
  adminDeB = (
    await prisma.usuario.create({
      data: {
        agenciaId: agenciaB,
        nome: 'Admin B',
        email: `admin-b-${sufixo}@ag.com`,
        papel: 'admin',
      },
    })
  ).id;
  appA = construir(usuarioTeste({ agenciaId: agenciaA, id: adminA }));
  appMembroA = construir(usuarioTeste({ agenciaId: agenciaA, id: membroA, papel: 'membro' }));
  appB = construir(usuarioTeste({ agenciaId: agenciaB, id: adminDeB }));
  appSemLogin = construir(null);
  await Promise.all([appA.ready(), appB.ready(), appMembroA.ready(), appSemLogin.ready()]);
});

afterAll(async () => {
  await Promise.all([appA.close(), appB.close(), appMembroA.close(), appSemLogin.close()]);
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
    expect(auditoria[0]).toMatchObject({ ator: `usuario:${adminA}`, acao: 'cliente.criado' });
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

// Daqui para baixo os testes criam mais clientes na agência A; ficam depois do teste de ordem da lista.
async function cadastrar(app: FastifyInstance, nome: string, extra: Record<string, unknown> = {}) {
  return app.inject({
    method: 'POST',
    url: '/clientes',
    payload: {
      nomeEmpresa: nome,
      nomeContato: 'Contato',
      email: `${nome.toLowerCase().replaceAll(' ', '-')}-${sufixo}@teste.com`,
      ...extra,
    },
  });
}

type RespostaCliente = {
  cliente: {
    id: string;
    onboarding: {
      id: string;
      statusGeral: string;
      responsavelId: string;
      etapas: { tipo: string; status: string }[];
    } | null;
  };
};

describe('RN-06 e RN-08 onboarding criado junto com o cliente', () => {
  it('cria um onboarding com as quatro etapas pendentes e o Admin como responsável', async () => {
    const resposta = await cadastrar(appA, 'Loja Um');
    expect(resposta.statusCode).toBe(201);
    const { cliente } = resposta.json<RespostaCliente>();
    expect(cliente.onboarding).toMatchObject({ statusGeral: 'criado', responsavelId: adminA });
    expect(cliente.onboarding?.etapas).toEqual([
      { tipo: 'formulario', status: 'pendente' },
      { tipo: 'acessos', status: 'pendente' },
      { tipo: 'reuniao', status: 'pendente' },
      { tipo: 'captacao', status: 'pendente' },
    ]);

    expect(await prisma.onboarding.count({ where: { clienteId: cliente.id } })).toBe(1);
    expect(
      await prisma.etapaOnboarding.count({ where: { agenciaId: agenciaA } }),
    ).toBeGreaterThanOrEqual(4);
    const auditoria = await prisma.auditoriaLog.findMany({
      where: { entidade: 'Onboarding', entidadeId: cliente.onboarding?.id ?? '' },
    });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({ acao: 'onboarding.criado', ator: `usuario:${adminA}` });
  });

  it('o Admin pode atribuir outro responsável', async () => {
    const resposta = await cadastrar(appA, 'Loja Dois', { responsavelId: membroA });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json<RespostaCliente>().cliente.onboarding?.responsavelId).toBe(membroA);
  });

  it('sem escolha, o responsável é o Admin mesmo quando quem cadastra é membro', async () => {
    const resposta = await cadastrar(appMembroA, 'Loja Tres');
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json<RespostaCliente>().cliente.onboarding?.responsavelId).toBe(adminA);
  });

  it('membro não escolhe responsável e nada é gravado', async () => {
    const resposta = await cadastrar(appMembroA, 'Loja Quatro', { responsavelId: membroA });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json<{ erro: string }>().erro).toBe('RN-08');
    expect(await prisma.cliente.count({ where: { nomeEmpresa: 'Loja Quatro' } })).toBe(0);
  });

  it('não aceita responsável de outra agência (RN-75)', async () => {
    const resposta = await cadastrar(appA, 'Loja Cinco', { responsavelId: adminDeB });
    expect(resposta.statusCode).toBe(404);
    expect(await prisma.cliente.count({ where: { nomeEmpresa: 'Loja Cinco' } })).toBe(0);
  });

  it('recusa o cadastro quando a agência não tem Admin ativo', async () => {
    const agenciaC = (await prisma.agencia.create({ data: { nome: 'C' } })).id;
    try {
      const membro = await prisma.usuario.create({
        data: { agenciaId: agenciaC, nome: 'M', email: `m-c-${sufixo}@ag.com`, papel: 'membro' },
      });
      const appC = construir(usuarioTeste({ agenciaId: agenciaC, id: membro.id, papel: 'membro' }));
      const resposta = await cadastrar(appC, 'Loja Seis');
      await appC.close();
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json<{ erro: string }>().erro).toBe('RN-08');
    } finally {
      await prisma.agencia.delete({ where: { id: agenciaC } });
    }
  });

  it('a lista traz o onboarding mais recente de cada cliente', async () => {
    const resposta = await appA.inject({ method: 'GET', url: '/clientes' });
    const { clientes } = resposta.json<{ clientes: RespostaCliente['cliente'][] }>();
    expect(clientes.length).toBeGreaterThan(3);
    for (const cliente of clientes) expect(cliente.onboarding?.etapas).toHaveLength(4);
  });
});

describe('RN-07 um onboarding ativo por cliente', () => {
  const novoOnboarding = (app: FastifyInstance, clienteId: string) =>
    app.inject({ method: 'POST', url: `/clientes/${clienteId}/onboardings`, payload: {} });

  it('recusa um segundo onboarding enquanto o primeiro está ativo', async () => {
    const { cliente } = (await cadastrar(appA, 'Loja Sete')).json<RespostaCliente>();
    const resposta = await novoOnboarding(appA, cliente.id);
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json<{ erro: string }>().erro).toBe('RN-07');
    expect(await prisma.onboarding.count({ where: { clienteId: cliente.id } })).toBe(1);
  });

  it('pausado continua ativo e também bloqueia', async () => {
    const { cliente } = (await cadastrar(appA, 'Loja Oito')).json<RespostaCliente>();
    await prisma.onboarding.updateMany({
      where: { clienteId: cliente.id },
      data: { statusGeral: 'pausado' },
    });
    expect((await novoOnboarding(appA, cliente.id)).statusCode).toBe(422);
  });

  it.each(['concluido', 'cancelado'] as const)('permite um novo depois de %s', async (status) => {
    const { cliente } = (await cadastrar(appA, `Loja ${status}`)).json<RespostaCliente>();
    await prisma.onboarding.updateMany({
      where: { clienteId: cliente.id },
      data: { statusGeral: status },
    });

    const resposta = await novoOnboarding(appA, cliente.id);
    expect(resposta.statusCode).toBe(201);
    expect(
      resposta.json<{ onboarding: { statusGeral: string; etapas: unknown[] } }>().onboarding,
    ).toMatchObject({
      statusGeral: 'criado',
      etapas: expect.arrayContaining([{ tipo: 'captacao', status: 'pendente' }]) as unknown[],
    });
    expect(await prisma.onboarding.count({ where: { clienteId: cliente.id } })).toBe(2);
  });

  it('duas requisições ao mesmo tempo criam só um onboarding ativo', async () => {
    const { cliente } = (await cadastrar(appA, 'Loja Corrida')).json<RespostaCliente>();
    await prisma.onboarding.updateMany({
      where: { clienteId: cliente.id },
      data: { statusGeral: 'concluido' },
    });

    const respostas = await Promise.all([
      novoOnboarding(appA, cliente.id),
      novoOnboarding(appA, cliente.id),
    ]);
    expect(respostas.map((r) => r.statusCode).sort()).toEqual([201, 422]);
    const ativos = await prisma.onboarding.count({
      where: { clienteId: cliente.id, statusGeral: 'criado' },
    });
    expect(ativos).toBe(1);
  });

  it('não enxerga cliente de outra agência (RN-75)', async () => {
    const { cliente } = (await cadastrar(appA, 'Loja Nove')).json<RespostaCliente>();
    expect((await novoOnboarding(appB, cliente.id)).statusCode).toBe(404);
  });

  it('exige usuário logado', async () => {
    expect((await novoOnboarding(appSemLogin, 'qualquer')).statusCode).toBe(401);
  });
});
