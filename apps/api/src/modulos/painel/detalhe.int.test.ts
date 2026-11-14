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
  return construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuario),
    }),
  );
}

const CAMPOS = [
  {
    chave: 'segmento',
    rotulo: 'Segmento',
    tipo: 'texto_curto',
    obrigatorio: true,
    arquivado: false,
  },
  { chave: 'logo', rotulo: 'Logo', tipo: 'upload', obrigatorio: false, arquivado: false },
  {
    chave: 'sobra',
    rotulo: 'Sem resposta',
    tipo: 'texto_curto',
    obrigatorio: false,
    arquivado: false,
  },
];

async function criarOnboarding(tag: string, status: 'em_andamento' | 'cancelado' = 'em_andamento') {
  const cliente = await prisma.cliente.create({
    data: {
      agenciaId,
      nomeEmpresa: `Loja ${tag}`,
      nomeContato: 'Bia',
      email: `${tag}-${sufixo}@x.com`,
    },
  });
  const onboarding = await prisma.onboarding.create({
    data: {
      agenciaId,
      clienteId: cliente.id,
      responsavelId,
      statusGeral: status,
      etapas: {
        create: (['captacao', 'formulario', 'reuniao', 'acessos'] as const).map((tipo) => ({
          agenciaId,
          tipo,
          status: tipo === 'formulario' ? ('concluida' as const) : ('pendente' as const),
        })),
      },
      link: {
        create: { agenciaId, tokenHash: gerarTokenLink().hash, expiraEm: AGORA_TESTE },
      },
    },
  });
  return { clienteId: cliente.id, id: onboarding.id };
}

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  outraAgenciaId = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const mk = (papel: 'admin' | 'membro', nome: string) =>
    prisma.usuario.create({ data: { agenciaId, nome, email: `${nome}-${sufixo}@ag.com`, papel } });
  adminId = (await mk('admin', 'Ana')).id;
  responsavelId = (await mk('membro', 'Rui')).id;
  outroId = (await mk('membro', 'Oto')).id;
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

const detalhe = (app: FastifyInstance, id: string) =>
  app.inject({ url: `/onboardings/${id}/detalhe` });

describe('RN-65 detalhe do onboarding', () => {
  it('mostra cliente, etapas na ordem, respostas com rótulo, acessos, agendamentos e arquivos', async () => {
    const { id, clienteId } = await criarOnboarding('completo');
    const versao = await prisma.versaoFormulario.create({
      data: { agenciaId, numero: 7, campos: CAMPOS },
    });
    const arquivo = await prisma.arquivo.create({
      data: {
        agenciaId,
        clienteId,
        nomeOriginal: 'logo.png',
        tipo: 'image/png',
        tamanho: 10,
        chave: 'k',
      },
    });
    await prisma.respostaFormulario.create({
      data: {
        agenciaId,
        onboardingId: id,
        versaoId: versao.id,
        respostas: { logo: arquivo.id, segmento: 'Moda' },
        enviadaEm: AGORA_TESTE,
      },
    });
    await prisma.agendamento.create({
      data: {
        agenciaId,
        onboardingId: id,
        tipo: 'reuniao',
        inicio: new Date('2026-11-20T13:00:00Z'),
        fim: new Date('2026-11-20T14:00:00Z'),
        localOuLink: 'https://meet.example/abc',
      },
    });

    const r = await detalhe(appAdmin, id);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      id,
      statusGeral: 'em_andamento',
      responsavel: { id: responsavelId, nome: 'Rui' },
      cliente: { id: clienteId, nomeEmpresa: 'Loja completo', nomeContato: 'Bia' },
      etapas: [
        { tipo: 'formulario', status: 'concluida' },
        { tipo: 'acessos' },
        { tipo: 'reuniao' },
        { tipo: 'captacao' },
      ],
      link: { expiraEm: AGORA_TESTE.toISOString() },
      formulario: {
        versao: 7,
        respostas: [
          { chave: 'segmento', rotulo: 'Segmento', valor: 'Moda' },
          { chave: 'logo', rotulo: 'Logo', tipo: 'upload', valor: arquivo.id },
        ],
      },
      acessos: { etapa: 'pendente' },
      agendamentos: [
        { tipo: 'reuniao', status: 'agendado', localOuLink: 'https://meet.example/abc' },
      ],
      arquivos: [{ id: arquivo.id, nomeOriginal: 'logo.png' }],
      notificacoes: [],
    });
  });

  it('Admin vê pausar, cancelar, reabrir, fechar, regenerar e exportar num onboarding ativo', async () => {
    const { id } = await criarOnboarding('acoes-admin');
    const versao = await prisma.versaoFormulario.findFirstOrThrow({ where: { agenciaId } });
    await prisma.respostaFormulario.create({
      data: {
        agenciaId,
        onboardingId: id,
        versaoId: versao.id,
        respostas: {},
        enviadaEm: AGORA_TESTE,
      },
    });
    expect((await detalhe(appAdmin, id)).json<{ acoes: unknown }>().acoes).toEqual({
      status: ['pausar', 'cancelar'],
      reabrirFormulario: true,
      fecharFormulario: true,
      regenerarLink: true,
      exportar: true,
      excluir: false,
    });
  });

  it('o responsável (membro) não vê ações de Admin nem de LGPD', async () => {
    const { id } = await criarOnboarding('acoes-membro');
    expect((await detalhe(appResponsavel, id)).json<{ acoes: unknown }>().acoes).toEqual({
      status: [],
      reabrirFormulario: true,
      fecharFormulario: false,
      regenerarLink: true,
      exportar: false,
      excluir: false,
    });
  });

  it('cancelado: só exportar e excluir', async () => {
    const { id } = await criarOnboarding('cancelado', 'cancelado');
    expect((await detalhe(appAdmin, id)).json<{ acoes: unknown }>().acoes).toEqual({
      status: [],
      reabrirFormulario: false,
      fecharFormulario: false,
      regenerarLink: false,
      exportar: true,
      excluir: true,
    });
  });

  it('membro que não é responsável não vê; outra agência não enxerga (RN-02, RN-75)', async () => {
    const { id } = await criarOnboarding('isolado');
    expect((await detalhe(appOutro, id)).statusCode).toBe(403);
    expect((await detalhe(appOutraAgencia, id)).statusCode).toBe(404);
  });
});
