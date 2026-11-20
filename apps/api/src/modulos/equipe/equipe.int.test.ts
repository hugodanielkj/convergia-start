import { randomUUID } from 'node:crypto';
import { relogioFixo } from '@convergia/core/base';
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
const email = (nome: string) => `${nome}-${sufixo}@agencia.com`;

let agenciaId: string;
let outraAgenciaId: string;
let adminId: string;
let membroId: string;
let appAdmin: FastifyInstance;
let appMembro: FastifyInstance;

const construir = (id: string, papel: 'admin' | 'membro') =>
  construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuarioTeste({ agenciaId, id, papel })),
    }),
  );

async function criarUsuario(
  nome: string,
  papel: 'admin' | 'membro' = 'membro',
  agencia = agenciaId,
) {
  const u = await prisma.usuario.create({
    data: { agenciaId: agencia, nome, email: email(nome), papel },
  });
  return u.id;
}

async function criarOnboarding(
  responsavelId: string,
  statusGeral: 'em_andamento' | 'concluido' | 'cancelado' | 'pausado',
) {
  const cliente = await prisma.cliente.create({
    data: {
      agenciaId,
      nomeEmpresa: `Loja ${randomUUID().slice(0, 6)}`,
      nomeContato: 'Bia',
      email: `${randomUUID().slice(0, 8)}@cliente.com`,
      onboardings: { create: { agenciaId, responsavelId, statusGeral } },
    },
    include: { onboardings: true },
  });
  const onboarding = cliente.onboardings[0];
  if (!onboarding) throw new Error('onboarding não criado');
  return onboarding.id;
}

const responsavelDe = async (id: string) =>
  (await prisma.onboarding.findUniqueOrThrow({ where: { id } })).responsavelId;

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `Agência ${sufixo}` } })).id;
  outraAgenciaId = (await prisma.agencia.create({ data: { nome: `Outra ${sufixo}` } })).id;
  adminId = await criarUsuario('ana', 'admin');
  membroId = await criarUsuario('rui');
  appAdmin = construir(adminId, 'admin');
  appMembro = construir(membroId, 'membro');
  await Promise.all([appAdmin.ready(), appMembro.ready()]);
});

afterAll(async () => {
  await Promise.all([appAdmin.close(), appMembro.close()]);
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaId, outraAgenciaId] } } });
  await prisma.$disconnect();
});

describe('RN-03 só o Admin mexe na equipe', () => {
  it('membro recebe 403 ao listar e ao cadastrar', async () => {
    const lista = await appMembro.inject({ method: 'GET', url: '/equipe' });
    expect(lista.statusCode).toBe(403);
    const novo = await appMembro.inject({
      method: 'POST',
      url: '/equipe',
      payload: { nome: 'X', email: email('x'), papel: 'membro' },
    });
    expect(novo.statusCode).toBe(403);
  });
});

describe('RN-03 cadastro da equipe', () => {
  it('cadastra com e-mail em minúsculas, lista e audita', async () => {
    const r = await appAdmin.inject({
      method: 'POST',
      url: '/equipe',
      payload: { nome: ' Caio ', email: ` CAIO-${sufixo}@Agencia.com `, papel: 'membro' },
    });
    expect(r.statusCode).toBe(201);
    const { pessoa } = r.json<{
      pessoa: { id: string; email: string; nome: string; ativo: boolean };
    }>();
    expect(pessoa).toMatchObject({ nome: 'Caio', email: email('caio'), ativo: true });

    const lista = await appAdmin.inject({ method: 'GET', url: '/equipe' });
    const { pessoas } = lista.json<{ pessoas: { id: string }[] }>();
    expect(pessoas.map((p) => p.id)).toContain(pessoa.id);

    const auditoria = await prisma.auditoriaLog.findFirst({
      where: { agenciaId, acao: 'equipe.cadastrada', entidadeId: pessoa.id },
    });
    expect(auditoria?.ator).toBe(`usuario:${adminId}`);
  });

  it('não lista gente de outra agência (RN-75)', async () => {
    const estranho = await criarUsuario('estranho', 'membro', outraAgenciaId);
    const { pessoas } = (await appAdmin.inject({ method: 'GET', url: '/equipe' })).json<{
      pessoas: { id: string }[];
    }>();
    expect(pessoas.map((p) => p.id)).not.toContain(estranho);
  });

  it('recusa e-mail que já está em uso, mesmo em outra agência', async () => {
    await criarUsuario('dani', 'membro', outraAgenciaId);
    for (const e of [email('rui'), email('dani')]) {
      const r = await appAdmin.inject({
        method: 'POST',
        url: '/equipe',
        payload: { nome: 'Repetido', email: e, papel: 'membro' },
      });
      expect(r.statusCode).toBe(409);
    }
  });

  it('recusa e-mail inválido', async () => {
    const r = await appAdmin.inject({
      method: 'POST',
      url: '/equipe',
      payload: { nome: 'Sem e-mail', email: 'nada@', papel: 'membro' },
    });
    expect(r.statusCode).toBe(422);
  });

  it('edita nome e papel de outra pessoa', async () => {
    const id = await criarUsuario('edu');
    const r = await appAdmin.inject({
      method: 'PATCH',
      url: `/equipe/${id}`,
      payload: { nome: 'Eduardo', papel: 'admin' },
    });
    expect(r.statusCode).toBe(200);
    const salvo = await prisma.usuario.findUniqueOrThrow({ where: { id } });
    expect(salvo).toMatchObject({ nome: 'Eduardo', papel: 'admin' });
  });

  it('o Admin não muda o próprio papel', async () => {
    const r = await appAdmin.inject({
      method: 'PATCH',
      url: `/equipe/${adminId}`,
      payload: { nome: 'Ana', papel: 'membro' },
    });
    expect(r.statusCode).toBe(422);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: adminId } })).papel).toBe(
      'admin',
    );
  });
});

describe('RN-03 desativar e reativar', () => {
  it('passa os onboardings em andamento para quem o Admin escolher e encerra as sessões', async () => {
    const saindo = await criarUsuario('saindo');
    const assume = await criarUsuario('assume');
    const ativo = await criarOnboarding(saindo, 'em_andamento');
    const pausado = await criarOnboarding(saindo, 'pausado');
    const concluido = await criarOnboarding(saindo, 'concluido');
    await prisma.sessao.create({
      data: { id: randomUUID(), agenciaId, usuarioId: saindo, expiraEm: new Date('2030-01-01') },
    });

    const r = await appAdmin.inject({
      method: 'POST',
      url: `/equipe/${saindo}/desativar`,
      payload: { novoResponsavelId: assume },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json<{ transferidos: number }>().transferidos).toBe(2);

    expect(await responsavelDe(ativo)).toBe(assume);
    expect(await responsavelDe(pausado)).toBe(assume);
    expect(await responsavelDe(concluido)).toBe(saindo);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: saindo } })).ativo).toBe(false);
    expect(await prisma.sessao.count({ where: { usuarioId: saindo } })).toBe(0);
    const auditoria = await prisma.auditoriaLog.findFirst({
      where: { agenciaId, acao: 'equipe.desativada', entidadeId: saindo },
    });
    expect(auditoria?.dados).toMatchObject({ novoResponsavelId: assume, transferidos: 2 });
  });

  it('sem escolha, o próprio Admin assume', async () => {
    const saindo = await criarUsuario('sozinho');
    const o = await criarOnboarding(saindo, 'em_andamento');
    const r = await appAdmin.inject({
      method: 'POST',
      url: `/equipe/${saindo}/desativar`,
      payload: {},
    });
    expect(r.statusCode).toBe(200);
    expect(await responsavelDe(o)).toBe(adminId);
  });

  it('não passa para quem está inativo, nem para a própria pessoa', async () => {
    const saindo = await criarUsuario('teimoso');
    const inativo = await criarUsuario('parado');
    await prisma.usuario.update({ where: { id: inativo }, data: { ativo: false } });
    for (const novoResponsavelId of [inativo, saindo]) {
      const r = await appAdmin.inject({
        method: 'POST',
        url: `/equipe/${saindo}/desativar`,
        payload: { novoResponsavelId },
      });
      expect(r.statusCode).toBe(422);
    }
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: saindo } })).ativo).toBe(true);
  });

  it('o Admin não desativa a si mesmo', async () => {
    const r = await appAdmin.inject({
      method: 'POST',
      url: `/equipe/${adminId}/desativar`,
      payload: {},
    });
    expect(r.statusCode).toBe(422);
  });

  it('reativar devolve o login, mas não os onboardings', async () => {
    const volta = await criarUsuario('volta');
    const o = await criarOnboarding(volta, 'em_andamento');
    await appAdmin.inject({ method: 'POST', url: `/equipe/${volta}/desativar`, payload: {} });
    const r = await appAdmin.inject({ method: 'POST', url: `/equipe/${volta}/reativar` });
    expect(r.statusCode).toBe(200);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: volta } })).ativo).toBe(true);
    expect(await responsavelDe(o)).toBe(adminId);
  });

  it('pessoa de outra agência dá 404', async () => {
    const estranho = await criarUsuario('longe', 'membro', outraAgenciaId);
    const r = await appAdmin.inject({
      method: 'POST',
      url: `/equipe/${estranho}/desativar`,
      payload: {},
    });
    expect(r.statusCode).toBe(404);
  });
});

describe('RN-08 trocar o responsável do onboarding', () => {
  it('o Admin troca para alguém ativo e fica na auditoria', async () => {
    const o = await criarOnboarding(adminId, 'em_andamento');
    const r = await appAdmin.inject({
      method: 'PUT',
      url: `/onboardings/${o}/responsavel`,
      payload: { responsavelId: membroId },
    });
    expect(r.statusCode).toBe(200);
    expect(await responsavelDe(o)).toBe(membroId);
    const auditoria = await prisma.auditoriaLog.findFirst({
      where: { agenciaId, acao: 'onboarding.responsavel_alterado', entidadeId: o },
    });
    expect(auditoria?.dados).toMatchObject({ de: adminId, para: membroId });
  });

  it('membro não troca (403) e pessoa inativa não assume (422)', async () => {
    const o = await criarOnboarding(membroId, 'em_andamento');
    const doMembro = await appMembro.inject({
      method: 'PUT',
      url: `/onboardings/${o}/responsavel`,
      payload: { responsavelId: adminId },
    });
    expect(doMembro.statusCode).toBe(403);

    const inativo = await criarUsuario('inativo');
    await prisma.usuario.update({ where: { id: inativo }, data: { ativo: false } });
    const r = await appAdmin.inject({
      method: 'PUT',
      url: `/onboardings/${o}/responsavel`,
      payload: { responsavelId: inativo },
    });
    expect(r.statusCode).toBe(422);
    expect(await responsavelDe(o)).toBe(membroId);
  });

  it('a lista de responsáveis traz só a equipe ativa', async () => {
    const inativo = await criarUsuario('fora');
    await prisma.usuario.update({ where: { id: inativo }, data: { ativo: false } });
    const r = await appAdmin.inject({ method: 'GET', url: '/equipe/responsaveis' });
    const { responsaveis } = r.json<{ responsaveis: { id: string }[] }>();
    const ids = responsaveis.map((p) => p.id);
    expect(ids).toContain(membroId);
    expect(ids).not.toContain(inativo);
  });
});
