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
const MS_DIA = 86_400_000;
let agenciaId: string;
let outraAgenciaId: string;
let adminId: string;
let anaId: string;
let beaId: string;
let appAdmin: FastifyInstance;
let appAna: FastifyInstance;
let appOutra: FastifyInstance;
let semLogin: FastifyInstance;

const ids: Record<string, string> = {};

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
  return construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuario),
    }),
  );
}

async function criar(
  ag: string,
  nome: string,
  responsavelId: string,
  extra: {
    status?: 'em_andamento' | 'concluido';
    etapas?: Partial<Record<string, 'concluida' | 'em_andamento'>>;
    criadoEm?: Date;
    linkExpirado?: boolean;
    atualizadoHaDias?: number;
  } = {},
) {
  const { hash } = gerarTokenLink();
  const cliente = await prisma.cliente.create({
    data: {
      agenciaId: ag,
      nomeEmpresa: `${nome} ${sufixo}`,
      nomeContato: 'C',
      email: `${nome}-${sufixo}@x.com`,
    },
  });
  const atividade = new Date(AGORA_TESTE.getTime() - (extra.atualizadoHaDias ?? 0) * MS_DIA);
  const o = await prisma.onboarding.create({
    data: {
      agenciaId: ag,
      clienteId: cliente.id,
      responsavelId,
      statusGeral: extra.status ?? 'em_andamento',
      criadoEm: extra.criadoEm ?? AGORA_TESTE,
      etapas: {
        create: ['formulario', 'acessos', 'reuniao', 'captacao'].map((tipo) => ({
          agenciaId: ag,
          tipo: tipo as 'formulario',
          status: extra.etapas?.[tipo] ?? 'pendente',
        })),
      },
      link: {
        create: {
          agenciaId: ag,
          tokenHash: hash,
          expiraEm: new Date(AGORA_TESTE.getTime() + (extra.linkExpirado ? -MS_DIA : 14 * MS_DIA)),
        },
      },
    },
  });
  // Força a data da última atividade (o Prisma a atualiza sozinho na criação).
  await prisma.$executeRaw`UPDATE onboardings SET "atualizadoEm" = ${atividade} WHERE id = ${o.id}`;
  await prisma.$executeRaw`UPDATE etapas_onboarding SET "atualizadoEm" = ${atividade} WHERE "onboardingId" = ${o.id}`;
  ids[nome] = o.id;
  return o;
}

interface Resposta {
  onboardings: {
    id: string;
    cliente: string;
    responsavel: string;
    statusGeral: string;
    progresso: { concluidas: number; total: number };
    atencao: string[];
  }[];
}
const listar = async (app: FastifyInstance, consulta = ''): Promise<Resposta['onboardings']> =>
  (await app.inject({ method: 'GET', url: `/painel/onboardings${consulta}` })).json<Resposta>()
    .onboardings;
const nomes = (l: Resposta['onboardings']) => l.map((x) => x.cliente.split(' ')[0]).sort();

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  outraAgenciaId = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const mk = (papel: 'admin' | 'membro', nome: string, ag = agenciaId) =>
    prisma.usuario.create({
      data: { agenciaId: ag, nome, email: `${nome}-${sufixo}@ag.com`, papel },
    });
  adminId = (await mk('admin', 'admin')).id;
  anaId = (await mk('membro', 'Ana')).id;
  beaId = (await mk('membro', 'Bea')).id;
  const outro = await mk('membro', 'Zed', outraAgenciaId);

  await criar(agenciaId, 'Alfa', anaId, {
    etapas: { formulario: 'concluida', acessos: 'em_andamento' },
  });
  await criar(agenciaId, 'Beta', beaId, {
    etapas: {
      formulario: 'concluida',
      acessos: 'concluida',
      reuniao: 'concluida',
      captacao: 'concluida',
    },
    status: 'concluido',
    criadoEm: new Date('2026-09-01T10:00:00Z'),
  });
  await criar(agenciaId, 'Gama', anaId, {
    linkExpirado: true,
    atualizadoHaDias: 5,
    criadoEm: new Date('2026-10-10T10:00:00Z'),
  });
  await criar(outraAgenciaId, 'Delta', outro.id);

  const alfa = ids['Alfa'] as string;
  await prisma.acessoPlataforma.create({
    data: {
      agenciaId,
      onboardingId: alfa,
      plataforma: 'instagram',
      status: 'invalido',
      motivo: 'x',
    },
  });

  appAdmin = construir(usuarioTeste({ agenciaId, id: adminId }));
  appAna = construir(usuarioTeste({ agenciaId, id: anaId, papel: 'membro' }));
  appOutra = construir(usuarioTeste({ agenciaId: outraAgenciaId, id: outro.id }));
  semLogin = construir(null);
  await Promise.all([appAdmin, appAna, appOutra, semLogin].map((a) => a.ready()));
});

afterAll(async () => {
  await Promise.all([appAdmin, appAna, appOutra, semLogin].map((a) => a.close()));
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaId, outraAgenciaId] } } });
  await prisma.$disconnect();
});

describe('RN-63 colunas do painel', () => {
  it('traz cliente, responsável, status, progresso e atenção', async () => {
    const lista = await listar(appAdmin);
    const alfa = lista.find((l) => l.cliente.startsWith('Alfa'));
    expect(alfa).toMatchObject({
      responsavel: 'Ana',
      statusGeral: 'em_andamento',
      progresso: { concluidas: 1, total: 4 },
      atencao: ['acesso_invalido'],
    });
    const gama = lista.find((l) => l.cliente.startsWith('Gama'));
    expect(gama?.atencao).toEqual(['link_expirado', 'parado']);
  });

  it('admin vê todos da agência e nada da outra (RN-75)', async () => {
    expect(nomes(await listar(appAdmin))).toEqual(['Alfa', 'Beta', 'Gama']);
    expect(nomes(await listar(appOutra))).toEqual(['Delta']);
  });

  it('membro só vê os seus, mesmo pedindo outro responsável (RN-02)', async () => {
    expect(nomes(await listar(appAna))).toEqual(['Alfa', 'Gama']);
    expect(nomes(await listar(appAna, `?responsavelId=${beaId}`))).toEqual(['Alfa', 'Gama']);
  });

  it('exige login', async () => {
    expect((await semLogin.inject({ method: 'GET', url: '/painel/onboardings' })).statusCode).toBe(
      401,
    );
  });
});

describe('RN-64 filtros', () => {
  it('por status', async () => {
    expect(nomes(await listar(appAdmin, '?status=concluido'))).toEqual(['Beta']);
  });

  it('por responsável (admin)', async () => {
    expect(nomes(await listar(appAdmin, `?responsavelId=${beaId}`))).toEqual(['Beta']);
  });

  it('por etapa pendente: só quem ainda não concluiu aquela etapa', async () => {
    expect(nomes(await listar(appAdmin, '?etapaPendente=acessos'))).toEqual(['Alfa', 'Gama']);
    expect(nomes(await listar(appAdmin, '?etapaPendente=formulario'))).toEqual(['Gama']);
  });

  it('por período de criação, inclusive o último dia', async () => {
    expect(nomes(await listar(appAdmin, '?de=2026-10-01&ate=2026-10-10'))).toEqual(['Gama']);
    expect(nomes(await listar(appAdmin, '?ate=2026-09-01'))).toEqual(['Beta']);
  });

  it('por indicador de atenção', async () => {
    expect(nomes(await listar(appAdmin, '?atencao=qualquer'))).toEqual(['Alfa', 'Gama']);
    expect(nomes(await listar(appAdmin, '?atencao=parado'))).toEqual(['Gama']);
    expect(nomes(await listar(appAdmin, '?atencao=acesso_invalido'))).toEqual(['Alfa']);
  });

  it('combina filtros e recusa valores inválidos', async () => {
    expect(nomes(await listar(appAdmin, `?responsavelId=${anaId}&atencao=link_expirado`))).toEqual([
      'Gama',
    ]);
    const r = await appAdmin.inject({ method: 'GET', url: '/painel/onboardings?status=xyz' });
    expect(r.statusCode).toBe(400);
  });
});
