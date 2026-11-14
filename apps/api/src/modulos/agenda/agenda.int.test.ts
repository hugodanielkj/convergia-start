import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarPrisma } from '../../base/prisma.js';
import { URL_BANCO_TESTE, dependenciasDeTeste, usuarioTeste } from '../../testes/dependencias.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const apps: FastifyInstance[] = [];
let agenciaA: string;
let agenciaB: string;
let adminA: string;
let membroA: string;
let adminB: string;
let appAdmin: FastifyInstance;
let appMembro: FastifyInstance;
let appAdminB: FastifyInstance;
let appSemLogin: FastifyInstance;

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
  const deps = dependenciasDeTeste({ prisma, resolverSessao: () => Promise.resolve(usuario) });
  const app = construirApp({ LOG_LEVEL: 'silent' }, deps);
  apps.push(app);
  return app;
}

beforeAll(async () => {
  const sufixo = randomUUID().slice(0, 8);
  agenciaA = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  agenciaB = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  const usuario = (agenciaId: string, papel: 'admin' | 'membro', apelido: string) =>
    prisma.usuario.create({
      data: { agenciaId, nome: apelido, email: `${apelido}-${sufixo}@ag.com`, papel },
    });
  adminA = (await usuario(agenciaA, 'admin', 'admin-a')).id;
  membroA = (await usuario(agenciaA, 'membro', 'membro-a')).id;
  adminB = (await usuario(agenciaB, 'admin', 'admin-b')).id;
  appAdmin = construir(usuarioTeste({ agenciaId: agenciaA, id: adminA }));
  appMembro = construir(usuarioTeste({ agenciaId: agenciaA, id: membroA, papel: 'membro' }));
  appAdminB = construir(usuarioTeste({ agenciaId: agenciaB, id: adminB }));
  appSemLogin = construir(null);
  await Promise.all(apps.map((app) => app.ready()));
});

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaA, agenciaB] } } });
  await prisma.$disconnect();
});

const janela = { tipo: 'reuniao', diaSemana: 1, horaInicio: '09:00', horaFim: '12:00' };
const criarJanela = (app: FastifyInstance, corpo: Record<string, unknown> = janela) =>
  app.inject({ method: 'POST', url: '/agenda/disponibilidades', payload: corpo });
const criarBloqueio = (app: FastifyInstance, corpo: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/agenda/bloqueios', payload: corpo });

describe('RN-03 quem pode mexer na agenda', () => {
  it('exige login', async () => {
    expect(
      (await appSemLogin.inject({ method: 'GET', url: '/agenda/disponibilidades' })).statusCode,
    ).toBe(401);
    expect((await criarJanela(appSemLogin)).statusCode).toBe(401);
    expect((await criarBloqueio(appSemLogin, {})).statusCode).toBe(401);
  });

  it('membro só consulta: cadastrar e remover é do Admin', async () => {
    expect((await criarJanela(appMembro)).statusCode).toBe(403);
    expect((await criarBloqueio(appMembro, {})).statusCode).toBe(403);
    expect(
      (await appMembro.inject({ method: 'DELETE', url: '/agenda/disponibilidades/x' })).statusCode,
    ).toBe(403);
    expect(
      (await appMembro.inject({ method: 'DELETE', url: '/agenda/bloqueios/x' })).statusCode,
    ).toBe(403);
    expect(
      (await appMembro.inject({ method: 'GET', url: '/agenda/disponibilidades' })).statusCode,
    ).toBe(200);
    expect((await appMembro.inject({ method: 'GET', url: '/agenda/bloqueios' })).statusCode).toBe(
      200,
    );
  });
});

describe('RN-30 disponibilidade', () => {
  it('cadastra a janela, devolve o que gravou e audita (RN-77)', async () => {
    const resposta = await criarJanela(appAdmin, { ...janela, duracaoMinutos: 45 });
    expect(resposta.statusCode).toBe(201);
    const { disponibilidade } = resposta.json<{ disponibilidade: { id: string } }>();
    expect(disponibilidade).toMatchObject({
      tipo: 'reuniao',
      diaSemana: 1,
      horaInicio: '09:00',
      horaFim: '12:00',
      duracaoMinutos: 45,
      usuarioId: null,
    });
    const auditoria = await prisma.auditoriaLog.findMany({
      where: { entidadeId: disponibilidade.id, acao: 'disponibilidade.criada' },
    });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]?.ator).toBe(`usuario:${adminA}`);
  });

  it('lista ordenada por tipo, dia e hora, só da própria agência (RN-75)', async () => {
    await criarJanela(appAdmin, {
      tipo: 'captacao',
      diaSemana: 3,
      horaInicio: '14:00',
      horaFim: '18:00',
    });
    await criarJanela(appAdmin, {
      tipo: 'reuniao',
      diaSemana: 1,
      horaInicio: '14:00',
      horaFim: '16:00',
    });
    await criarJanela(appAdminB, janela);

    const lista = (await appAdmin.inject({ method: 'GET', url: '/agenda/disponibilidades' })).json<{
      disponibilidades: { tipo: string; diaSemana: number; horaInicio: string }[];
    }>().disponibilidades;
    expect(lista.map((d) => `${d.tipo} ${String(d.diaSemana)} ${d.horaInicio}`)).toEqual([
      'reuniao 1 09:00',
      'reuniao 1 14:00',
      'captacao 3 14:00',
    ]);
  });

  it.each([
    [{ diaSemana: 7 }, 'dia_invalido'],
    [{ horaInicio: '9h' }, 'hora_invalida'],
    [{ horaInicio: '12:00', horaFim: '09:00' }, 'intervalo_invalido'],
    [{ duracaoMinutos: 0 }, 'duracao_invalida'],
    [{ duracaoMinutos: 400 }, 'duracao_invalida'],
  ])('recusa janela inválida %j', async (alteracao, codigo) => {
    const resposta = await criarJanela(appAdmin, { ...janela, diaSemana: 5, ...alteracao });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json()).toEqual({ erro: 'JANELA_INVALIDA', codigo });
  });

  it('recusa corpo com formato inesperado', async () => {
    const resposta = await criarJanela(appAdmin, { tipo: 'jantar', diaSemana: 'segunda' });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json<{ erro: string }>().erro).toBe('VALIDACAO');
  });

  it('recusa janela que se sobrepõe a outra do mesmo tipo e dia', async () => {
    await criarJanela(appAdmin, { ...janela, diaSemana: 2, horaInicio: '08:00', horaFim: '10:00' });
    const resposta = await criarJanela(appAdmin, {
      ...janela,
      diaSemana: 2,
      horaInicio: '09:30',
      horaFim: '11:00',
    });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json<{ erro: string }>().erro).toBe('RN-30');
  });

  it('aceita janelas que só se encostam, e a mesma hora em outro tipo, dia ou agência', async () => {
    await criarJanela(appAdmin, { ...janela, diaSemana: 4, horaInicio: '08:00', horaFim: '10:00' });
    const casos = [
      criarJanela(appAdmin, { ...janela, diaSemana: 4, horaInicio: '10:00', horaFim: '12:00' }),
      criarJanela(appAdmin, {
        ...janela,
        tipo: 'captacao',
        diaSemana: 4,
        horaInicio: '08:00',
        horaFim: '10:00',
      }),
      criarJanela(appAdmin, { ...janela, diaSemana: 5, horaInicio: '08:00', horaFim: '10:00' }),
      criarJanela(appAdminB, { ...janela, diaSemana: 4, horaInicio: '08:00', horaFim: '10:00' }),
    ];
    for (const resposta of await Promise.all(casos)) expect(resposta.statusCode).toBe(201);
  });

  it('janelas de profissionais diferentes não se sobrepõem; o profissional precisa ser da agência', async () => {
    const corpo = { ...janela, diaSemana: 6, horaInicio: '08:00', horaFim: '10:00' };
    expect((await criarJanela(appAdmin, { ...corpo, usuarioId: adminA })).statusCode).toBe(201);
    expect((await criarJanela(appAdmin, { ...corpo, usuarioId: membroA })).statusCode).toBe(201);
    expect((await criarJanela(appAdmin, { ...corpo, usuarioId: adminA })).statusCode).toBe(422);
    expect((await criarJanela(appAdmin, { ...corpo, usuarioId: adminB })).statusCode).toBe(404);
  });

  it('remove a janela, audita e não alcança a de outra agência', async () => {
    const { disponibilidade } = (await criarJanela(appAdmin, { ...janela, diaSemana: 0 })).json<{
      disponibilidade: { id: string };
    }>();
    const alheia = (await criarJanela(appAdminB, { ...janela, diaSemana: 0 })).json<{
      disponibilidade: { id: string };
    }>().disponibilidade;

    expect(
      (await appAdmin.inject({ method: 'DELETE', url: `/agenda/disponibilidades/${alheia.id}` }))
        .statusCode,
    ).toBe(404);
    expect(await prisma.disponibilidade.count({ where: { id: alheia.id } })).toBe(1);

    expect(
      (
        await appAdmin.inject({
          method: 'DELETE',
          url: `/agenda/disponibilidades/${disponibilidade.id}`,
        })
      ).statusCode,
    ).toBe(204);
    expect(await prisma.disponibilidade.count({ where: { id: disponibilidade.id } })).toBe(0);
    expect(
      await prisma.auditoriaLog.count({
        where: { entidadeId: disponibilidade.id, acao: 'disponibilidade.removida' },
      }),
    ).toBe(1);
    expect(
      (
        await appAdmin.inject({
          method: 'DELETE',
          url: `/agenda/disponibilidades/${disponibilidade.id}`,
        })
      ).statusCode,
    ).toBe(404);
  });

  it('o banco recusa dados fora do formato mesmo por SQL direto', async () => {
    const base = { agenciaId: agenciaA, tipo: 'reuniao' as const, diaSemana: 1 };
    await expect(
      prisma.disponibilidade.create({ data: { ...base, horaInicio: '12:00', horaFim: '09:00' } }),
    ).rejects.toThrow();
    await expect(
      prisma.disponibilidade.create({ data: { ...base, horaInicio: '9:00', horaFim: '10:00' } }),
    ).rejects.toThrow();
    await expect(
      prisma.disponibilidade.create({
        data: { ...base, diaSemana: 9, horaInicio: '09:00', horaFim: '10:00' },
      }),
    ).rejects.toThrow();
  });
});

describe('RN-44 bloqueios', () => {
  const recesso = {
    dataInicio: '2026-12-28',
    dataFim: '2027-01-02',
    motivo: 'Recesso de fim de ano',
  };

  it('cadastra o bloqueio com datas de calendário e audita sem gravar o motivo', async () => {
    const resposta = await criarBloqueio(appAdmin, {
      ...recesso,
      motivo: '  Recesso de fim de ano ',
    });
    expect(resposta.statusCode).toBe(201);
    const { bloqueio } = resposta.json<{ bloqueio: { id: string } }>();
    expect(bloqueio).toMatchObject(recesso);
    const auditoria = await prisma.auditoriaLog.findFirstOrThrow({
      where: { entidadeId: bloqueio.id, acao: 'bloqueio.criado' },
    });
    expect(JSON.stringify(auditoria.dados ?? {})).not.toContain('Recesso');
  });

  it('lista por data, só da própria agência', async () => {
    await criarBloqueio(appAdmin, {
      dataInicio: '2026-11-10',
      dataFim: '2026-11-10',
      motivo: 'Folga',
    });
    await criarBloqueio(appAdminB, {
      dataInicio: '2026-10-01',
      dataFim: '2026-10-02',
      motivo: 'Outra agência',
    });
    const lista = (await appAdmin.inject({ method: 'GET', url: '/agenda/bloqueios' })).json<{
      bloqueios: { dataInicio: string; motivo: string }[];
    }>().bloqueios;
    expect(lista.map((b) => b.dataInicio)).toEqual(['2026-11-10', '2026-12-28']);
  });

  it.each([
    [{ dataInicio: '2026-02-30' }, 'data_invalida'],
    [{ dataInicio: '2026-12-05', dataFim: '2026-12-01' }, 'intervalo_invalido'],
    [{ motivo: '   ' }, 'motivo_obrigatorio'],
    [{ motivo: 'x'.repeat(201) }, 'motivo_invalido'],
  ])('recusa bloqueio inválido %j', async (alteracao, codigo) => {
    const resposta = await criarBloqueio(appAdmin, { ...recesso, ...alteracao });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json()).toEqual({ erro: 'BLOQUEIO_INVALIDO', codigo });
  });

  it('remove o bloqueio e não alcança o de outra agência', async () => {
    const { bloqueio } = (
      await criarBloqueio(appAdmin, { ...recesso, dataInicio: '2027-03-01', dataFim: '2027-03-01' })
    ).json<{
      bloqueio: { id: string };
    }>();
    const alheio = (
      await criarBloqueio(appAdminB, {
        ...recesso,
        dataInicio: '2027-03-01',
        dataFim: '2027-03-01',
      })
    ).json<{
      bloqueio: { id: string };
    }>().bloqueio;

    expect(
      (await appAdmin.inject({ method: 'DELETE', url: `/agenda/bloqueios/${alheio.id}` }))
        .statusCode,
    ).toBe(404);
    expect(
      (await appAdmin.inject({ method: 'DELETE', url: `/agenda/bloqueios/${bloqueio.id}` }))
        .statusCode,
    ).toBe(204);
    expect(await prisma.bloqueio.count({ where: { id: bloqueio.id } })).toBe(0);
    expect(
      await prisma.auditoriaLog.count({
        where: { entidadeId: bloqueio.id, acao: 'bloqueio.removido' },
      }),
    ).toBe(1);
  });
});

describe('RN-44 feriados nacionais', () => {
  it('lista os feriados do ano pedido', async () => {
    const resposta = await appMembro.inject({ method: 'GET', url: '/agenda/feriados?ano=2026' });
    expect(resposta.statusCode).toBe(200);
    const { feriados } = resposta.json<{ feriados: { data: string; nome: string }[] }>();
    expect(feriados).toHaveLength(10);
    expect(feriados[1]).toEqual({ data: '2026-04-03', nome: 'Sexta-feira Santa' });
  });

  it('sem ano, usa o ano do relógio da API', async () => {
    const { feriados } = (await appMembro.inject({ method: 'GET', url: '/agenda/feriados' })).json<{
      feriados: { data: string }[];
    }>();
    expect(feriados[0]?.data).toBe('2026-01-01');
  });

  it.each(['abc', '1800', '2500', '2026.5'])('recusa ano %s', async (ano) => {
    expect(
      (await appMembro.inject({ method: 'GET', url: `/agenda/feriados?ano=${ano}` })).statusCode,
    ).toBe(400);
  });
});
