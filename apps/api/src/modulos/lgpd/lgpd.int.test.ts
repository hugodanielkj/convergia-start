import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import { gerarTokenLink } from '@convergia/core/link';
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
const excluidosPublicados: string[] = [];
let agenciaId: string;
let outraAgenciaId: string;
let adminId: string;
let responsavelId: string;
let outroId: string;
let appAdmin: FastifyInstance;
let appResponsavel: FastifyInstance;
let appOutro: FastifyInstance;
let appOutraAgencia: FastifyInstance;

function construir(usuario: UsuarioAutenticado): FastifyInstance {
  const app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuario),
    }),
  );
  app.deps.eventos.assinar('cliente.dados_excluidos', (e) => {
    excluidosPublicados.push(e.dados.clienteId);
    return Promise.resolve();
  });
  return app;
}

let horario = 0;
/** Cliente completo: onboarding, etapa, link, histórico, consentimento, respostas, acesso, agendamento, arquivo. */
async function criarClienteCompleto(
  tag: string,
  status: 'em_andamento' | 'cancelado' = 'cancelado',
) {
  const cliente = await prisma.cliente.create({
    data: {
      agenciaId,
      nomeEmpresa: `Padaria ${tag}`,
      nomeContato: 'Maria',
      email: `${tag}-${sufixo}@x.com`,
    },
  });
  const onboarding = await prisma.onboarding.create({
    data: {
      agenciaId,
      clienteId: cliente.id,
      responsavelId,
      statusGeral: status,
      etapas: { create: [{ agenciaId, tipo: 'formulario', status: 'concluida' }] },
      link: {
        create: { agenciaId, tokenHash: gerarTokenLink().hash, expiraEm: AGORA_TESTE },
      },
      transicoes: {
        create: {
          agenciaId,
          de: 'em_andamento',
          para: 'cancelado',
          motivo: 'desistiu',
          ator: `usuario:${adminId}`,
        },
      },
    },
  });
  const onboardingId = onboarding.id;
  horario += 1;
  const inicio = new Date(AGORA_TESTE.getTime() + horario * 3_600_000);
  const agendamento = await prisma.agendamento.create({
    data: {
      agenciaId,
      onboardingId,
      tipo: 'reuniao',
      status: 'cancelado',
      inicio,
      fim: new Date(inicio.getTime() + 1_800_000),
    },
  });
  const versao =
    (await prisma.versaoFormulario.findFirst({ where: { agenciaId } })) ??
    (await prisma.versaoFormulario.create({ data: { agenciaId, numero: 1, campos: [] } }));
  await prisma.$transaction([
    prisma.primeiroAcesso.create({ data: { agenciaId, onboardingId, em: AGORA_TESTE } }),
    prisma.consentimentoCliente.create({
      data: { agenciaId, onboardingId, versaoTermo: 'v1', aceitoEm: AGORA_TESTE },
    }),
    prisma.respostaFormulario.create({
      data: {
        agenciaId,
        onboardingId,
        versaoId: versao.id,
        respostas: { segmento: 'pães' },
        enviadaEm: AGORA_TESTE,
      },
    }),
    prisma.acessoPlataforma.create({
      data: { agenciaId, onboardingId, plataforma: 'instagram', status: 'concedido' },
    }),
    prisma.auditoriaLog.createMany({
      data: [
        {
          agenciaId,
          ator: `usuario:${adminId}`,
          acao: 'cliente.criado',
          entidade: 'Cliente',
          entidadeId: cliente.id,
          dados: { empresa: cliente.nomeEmpresa },
          em: new Date(AGORA_TESTE.getTime() - 3 * 86_400_000),
        },
        {
          agenciaId,
          ator: `cliente:${onboardingId}`,
          acao: 'formulario.enviado',
          entidade: 'Onboarding',
          entidadeId: onboardingId,
          em: new Date(AGORA_TESTE.getTime() - 2 * 86_400_000),
        },
        {
          agenciaId,
          ator: `usuario:${adminId}`,
          acao: 'onboarding.status_alterado',
          entidade: 'Onboarding',
          entidadeId: onboardingId,
          dados: { de: 'em_andamento', para: 'cancelado', motivo: 'desistiu' },
          em: new Date(AGORA_TESTE.getTime() - 86_400_000),
        },
        {
          agenciaId,
          ator: 'sistema',
          acao: 'agendamento.cancelado',
          entidade: 'Agendamento',
          entidadeId: agendamento.id,
          em: new Date(AGORA_TESTE.getTime() - 86_400_000 + 1000),
        },
      ],
    }),
  ]);
  return {
    clienteId: cliente.id,
    onboardingId,
    agendamentoId: agendamento.id,
    nomeEmpresa: cliente.nomeEmpresa,
  };
}

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  outraAgenciaId = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const mk = (papel: 'admin' | 'membro', nome: string) =>
    prisma.usuario.create({ data: { agenciaId, nome, email: `${nome}-${sufixo}@ag.com`, papel } });
  adminId = (await mk('admin', 'Ana Admin')).id;
  responsavelId = (await mk('membro', 'Rui Resp')).id;
  outroId = (await mk('membro', 'Oto Outro')).id;
  appAdmin = construir(usuarioTeste({ agenciaId, id: adminId }));
  appResponsavel = construir(usuarioTeste({ agenciaId, id: responsavelId, papel: 'membro' }));
  appOutro = construir(usuarioTeste({ agenciaId, id: outroId, papel: 'membro' }));
  appOutraAgencia = construir(usuarioTeste({ agenciaId: outraAgenciaId, id: adminId }));
  await Promise.all([appAdmin, appResponsavel, appOutro, appOutraAgencia].map((a) => a.ready()));
});

afterAll(async () => {
  await Promise.all([appAdmin, appResponsavel, appOutro, appOutraAgencia].map((a) => a.close()));
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaId, outraAgenciaId] } } });
  await prisma.$disconnect();
});

interface Item {
  acao: string;
  entidade: string;
  ator: { tipo: string; nome: string | null };
  dados: unknown;
}
const auditoria = (app: FastifyInstance, id: string, query = '') =>
  app.inject({ url: `/onboardings/${id}/auditoria${query}` });

describe('RN-77 auditoria consultável do onboarding', () => {
  it('lista do mais recente ao mais antigo, com cliente e agendamentos, e nome de quem agiu', async () => {
    const { onboardingId } = await criarClienteCompleto('linha');
    const r = await auditoria(appResponsavel, onboardingId);
    expect(r.statusCode).toBe(200);
    const { itens } = r.json<{ itens: Item[] }>();
    expect(itens.map((i) => i.acao)).toEqual([
      'agendamento.cancelado',
      'onboarding.status_alterado',
      'formulario.enviado',
      'cliente.criado',
    ]);
    expect(itens[0]?.ator).toEqual({ tipo: 'sistema', nome: null });
    expect(itens[1]?.ator).toEqual({ tipo: 'usuario', nome: 'Ana Admin' });
    expect(itens[2]?.ator).toEqual({ tipo: 'cliente', nome: 'Maria' });
  });

  it('filtra por período, por ação e por grupo de ações', async () => {
    const { onboardingId } = await criarClienteCompleto('filtro');
    const desde = new Date(AGORA_TESTE.getTime() - 1.5 * 86_400_000).toISOString();
    const periodo = (await auditoria(appAdmin, onboardingId, `?de=${desde}`)).json<{
      itens: Item[];
    }>();
    expect(periodo.itens).toHaveLength(2);
    const exata = (await auditoria(appAdmin, onboardingId, '?acao=formulario.enviado')).json<{
      itens: Item[];
    }>();
    expect(exata.itens.map((i) => i.acao)).toEqual(['formulario.enviado']);
    const grupo = (await auditoria(appAdmin, onboardingId, '?acao=onboarding.&limite=1')).json<{
      itens: Item[];
    }>();
    expect(grupo.itens.map((i) => i.acao)).toEqual(['onboarding.status_alterado']);
    expect((await auditoria(appAdmin, onboardingId, '?acao=DROP;')).statusCode).toBe(400);
  });

  it('membro que não é responsável não vê; outra agência não enxerga (RN-02, RN-75)', async () => {
    const { onboardingId } = await criarClienteCompleto('isola');
    expect((await auditoria(appOutro, onboardingId)).statusCode).toBe(403);
    expect((await auditoria(appOutraAgencia, onboardingId)).statusCode).toBe(404);
  });
});

describe('RN-73 exportação dos dados do cliente', () => {
  it('o Admin baixa um JSON com tudo o que a agência guarda, sem o token do link', async () => {
    const c = await criarClienteCompleto('exporta');
    const r = await appAdmin.inject({ url: `/clientes/${c.clienteId}/exportacao` });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-disposition']).toBe(
      `attachment; filename="dados-padaria-exporta-2026-11-16.json"`,
    );
    expect(r.headers['cache-control']).toBe('private, no-store');
    const dados = r.json<Record<string, unknown>>();
    expect(dados).toMatchObject({
      cliente: { id: c.clienteId, nomeEmpresa: c.nomeEmpresa, nomeContato: 'Maria' },
      onboardings: [
        {
          id: c.onboardingId,
          statusGeral: 'cancelado',
          responsavel: 'Rui Resp',
          primeiroAcessoEm: AGORA_TESTE.toISOString(),
          consentimentos: [{ versaoTermo: 'v1' }],
          formulario: { respostas: { segmento: 'pães' }, versao: { numero: 1 } },
          acessos: [{ plataforma: 'instagram', status: 'concedido' }],
          agendamentos: [{ id: c.agendamentoId, tipo: 'reuniao', status: 'cancelado' }],
          transicoes: [{ para: 'cancelado', motivo: 'desistiu' }],
        },
      ],
    });
    expect(JSON.stringify(dados)).not.toContain('tokenHash');
    expect((dados['auditoria'] as unknown[]).length).toBe(4);
    const registrada = await prisma.auditoriaLog.count({
      where: { entidadeId: c.clienteId, acao: 'cliente.dados_exportados' },
    });
    expect(registrada).toBe(1);
  });

  it('só o Admin exporta, e só clientes da própria agência', async () => {
    const c = await criarClienteCompleto('exporta-nao');
    expect(
      (await appResponsavel.inject({ url: `/clientes/${c.clienteId}/exportacao` })).statusCode,
    ).toBe(403);
    expect(
      (await appOutraAgencia.inject({ url: `/clientes/${c.clienteId}/exportacao` })).statusCode,
    ).toBe(404);
  });
});

describe('RN-73 exclusão dos dados do cliente', () => {
  const excluir = (app: FastifyInstance, clienteId: string, confirmacao: string) =>
    app.inject({
      method: 'POST',
      url: `/clientes/${clienteId}/exclusao`,
      payload: { confirmacao },
    });

  it('apaga tudo; a auditoria fica sem dados pessoais', async () => {
    const c = await criarClienteCompleto('exclui');
    const r = await excluir(appAdmin, c.clienteId, ` ${c.nomeEmpresa.toUpperCase()} `);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ onboardings: 1 });

    const doOnboarding = { where: { onboardingId: c.onboardingId } };
    const restantes = await Promise.all([
      prisma.cliente.count({ where: { id: c.clienteId } }),
      prisma.onboarding.count({ where: { id: c.onboardingId } }),
      prisma.etapaOnboarding.count(doOnboarding),
      prisma.linkOnboarding.count(doOnboarding),
      prisma.transicaoStatus.count(doOnboarding),
      prisma.agendamento.count(doOnboarding),
      prisma.primeiroAcesso.count(doOnboarding),
      prisma.consentimentoCliente.count(doOnboarding),
      prisma.respostaFormulario.count(doOnboarding),
      prisma.acessoPlataforma.count(doOnboarding),
    ]);
    expect(restantes).toEqual(Array<number>(restantes.length).fill(0));

    const log = await prisma.auditoriaLog.findMany({
      where: { entidadeId: { in: [c.clienteId, c.onboardingId, c.agendamentoId] } },
    });
    const excluido = log.find((l) => l.acao === 'cliente.dados_excluidos');
    expect(excluido?.dados).toEqual({ onboardings: 1 });
    expect(log.filter((l) => l !== excluido).every((l) => l.dados === null)).toBe(true);
    expect(log).toHaveLength(5);
    expect(excluidosPublicados).toContain(c.clienteId);
  });

  it('recusa com onboarding ativo e com confirmação errada, sem apagar nada', async () => {
    const ativo = await criarClienteCompleto('ativo', 'em_andamento');
    const r = await excluir(appAdmin, ativo.clienteId, ativo.nomeEmpresa);
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({ erro: 'RN-73' });

    const errado = await criarClienteCompleto('errado');
    expect((await excluir(appAdmin, errado.clienteId, 'Outra Empresa')).statusCode).toBe(422);
    expect(
      await prisma.cliente.count({ where: { id: { in: [ativo.clienteId, errado.clienteId] } } }),
    ).toBe(2);
  });

  it('só o Admin exclui, e só clientes da própria agência', async () => {
    const c = await criarClienteCompleto('exclui-nao');
    expect((await excluir(appResponsavel, c.clienteId, c.nomeEmpresa)).statusCode).toBe(403);
    expect((await excluir(appOutraAgencia, c.clienteId, c.nomeEmpresa)).statusCode).toBe(404);
    expect(await prisma.cliente.count({ where: { id: c.clienteId } })).toBe(1);
  });
});
