import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarPrisma } from '../../base/prisma.js';
import { URL_BANCO_TESTE, dependenciasDeTeste, usuarioTeste } from '../../testes/dependencias.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
let agenciaA: string;
let agenciaB: string;
let admin: FastifyInstance;
let membro: FastifyInstance;
let outraAgencia: FastifyInstance;
let semLogin: FastifyInstance;

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
  return construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({ prisma, resolverSessao: () => Promise.resolve(usuario) }),
  );
}

interface Campo {
  chave: string;
  rotulo: string;
  tipo: string;
  obrigatorio: boolean;
  arquivado: boolean;
  opcoes?: string[];
}
interface Modelo {
  versaoPublicada: { numero: number; campos: Campo[] };
  rascunho: Campo[];
  temAlteracoes: boolean;
}

const obter = async (app: FastifyInstance): Promise<Modelo> =>
  (await app.inject({ method: 'GET', url: '/formulario/modelo' })).json<Modelo>();

const salvar = (app: FastifyInstance, campos: unknown[]) =>
  app.inject({ method: 'PUT', url: '/formulario/modelo/rascunho', payload: { campos } });

const publicar = (app: FastifyInstance) =>
  app.inject({ method: 'POST', url: '/formulario/modelo/publicar' });

beforeAll(async () => {
  agenciaA = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  agenciaB = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  const sufixo = randomUUID().slice(0, 6);
  admin = construir(usuarioTeste({ agenciaId: agenciaA, id: `adm-${sufixo}`, papel: 'admin' }));
  membro = construir(usuarioTeste({ agenciaId: agenciaA, id: `mem-${sufixo}`, papel: 'membro' }));
  outraAgencia = construir(usuarioTeste({ agenciaId: agenciaB, id: `adm-b-${sufixo}` }));
  semLogin = construir(null);
  await Promise.all([admin.ready(), membro.ready(), outraAgencia.ready(), semLogin.ready()]);
});

afterAll(async () => {
  await Promise.all([admin.close(), membro.close(), outraAgencia.close(), semLogin.close()]);
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaA, agenciaB] } } });
  await prisma.$disconnect();
});

describe('RN-03 só o admin mexe no modelo', () => {
  it('recusa sem login (401) e membro (403)', async () => {
    expect((await semLogin.inject({ method: 'GET', url: '/formulario/modelo' })).statusCode).toBe(
      401,
    );
    expect((await membro.inject({ method: 'GET', url: '/formulario/modelo' })).statusCode).toBe(
      403,
    );
    expect((await salvar(membro, [])).statusCode).toBe(403);
    expect((await publicar(membro)).statusCode).toBe(403);
  });
});

describe('RN-19 modelo padrão', () => {
  it('a agência já nasce com a versão 1 publicada com os campos sugeridos', async () => {
    const modelo = await obter(admin);
    expect(modelo.versaoPublicada.numero).toBe(1);
    expect(modelo.versaoPublicada.campos.map((c) => c.chave)).toContain('tom_de_voz');
    expect(modelo.rascunho).toEqual(modelo.versaoPublicada.campos);
    expect(modelo.temAlteracoes).toBe(false);
  });

  it('abrir duas vezes não duplica a versão', async () => {
    await Promise.all([obter(admin), obter(admin), obter(admin)]);
    expect(await prisma.versaoFormulario.count({ where: { agenciaId: agenciaA } })).toBe(1);
  });
});

describe('RN-15 rascunho e publicação de versões', () => {
  it('salvar só grava rascunho; a versão publicada não muda', async () => {
    const { rascunho } = await obter(admin);
    const editado = rascunho.map((c) =>
      c.chave === 'segmento' ? { ...c, rotulo: 'Ramo de atividade' } : c,
    );
    expect((await salvar(admin, editado)).statusCode).toBe(200);

    const modelo = await obter(admin);
    expect(modelo.temAlteracoes).toBe(true);
    expect(modelo.rascunho.find((c) => c.chave === 'segmento')?.rotulo).toBe('Ramo de atividade');
    expect(modelo.versaoPublicada.campos.find((c) => c.chave === 'segmento')?.rotulo).toBe(
      'Segmento de atuação',
    );
  });

  it('publicar cria a versão 2, mantém a 1 intacta e audita (RN-77)', async () => {
    const resposta = await publicar(admin);
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json<{ numero: number }>().numero).toBe(2);

    const modelo = await obter(admin);
    expect(modelo.versaoPublicada.numero).toBe(2);
    expect(modelo.temAlteracoes).toBe(false);

    const v1 = await prisma.versaoFormulario.findFirstOrThrow({
      where: { agenciaId: agenciaA, numero: 1 },
    });
    expect(JSON.stringify(v1.campos)).toContain('Segmento de atuação');

    const auditoria = await prisma.auditoriaLog.findMany({
      where: { agenciaId: agenciaA, acao: 'formulario.versao_publicada' },
    });
    expect(auditoria).toHaveLength(1);
  });

  it('não publica quando não há alterações', async () => {
    const resposta = await publicar(admin);
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json<{ erro: string }>().erro).toBe('SEM_ALTERACOES');
  });

  it('arquivar um campo publicado vale; trocar tipo ou apagar é recusado', async () => {
    const { rascunho } = await obter(admin);
    const arquivado = rascunho.map((c) =>
      c.chave === 'concorrentes' ? { ...c, arquivado: true } : c,
    );
    expect((await salvar(admin, arquivado)).statusCode).toBe(200);

    const trocaTipo = rascunho.map((c) => (c.chave === 'segmento' ? { ...c, tipo: 'numero' } : c));
    const resposta = await salvar(admin, trocaTipo);
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json<{ erros: unknown[] }>().erros).toEqual([
      { chave: 'segmento', codigo: 'tipo_alterado' },
    ]);

    const apagado = rascunho.filter((c) => c.chave !== 'contato_aprovacao');
    expect((await salvar(admin, apagado)).json<{ erros: unknown[] }>().erros).toEqual([
      { chave: 'contato_aprovacao', codigo: 'campo_removido' },
    ]);
  });

  it('campo novo ganha chave estável gerada do rótulo (RN-16)', async () => {
    const { rascunho } = await obter(admin);
    const novo = {
      rotulo: 'Cor favorita',
      tipo: 'selecao_unica',
      obrigatorio: false,
      opcoes: ['Azul', 'Verde'],
    };
    const resposta = await salvar(admin, [...rascunho, novo]);
    expect(resposta.statusCode).toBe(200);
    const salvo = (await obter(admin)).rascunho.at(-1);
    expect(salvo).toMatchObject({ chave: 'cor_favorita', arquivado: false, tipo: 'selecao_unica' });
  });

  it('devolve os erros de validação do modelo (RN-16)', async () => {
    const { rascunho } = await obter(admin);
    const ruim = {
      rotulo: 'Escolha',
      tipo: 'selecao_unica',
      obrigatorio: false,
      opcoes: ['Só uma'],
    };
    const resposta = await salvar(admin, [...rascunho, ruim]);
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json<{ erros: unknown[] }>().erros).toEqual([
      { chave: 'escolha', codigo: 'opcoes_insuficientes' },
    ]);
  });
});

describe('RN-75 isolamento por agência', () => {
  it('cada agência tem o próprio modelo', async () => {
    const outra = await obter(outraAgencia);
    expect(outra.versaoPublicada.numero).toBe(1);
    expect(outra.temAlteracoes).toBe(false);
    expect(await prisma.versaoFormulario.count({ where: { agenciaId: agenciaB } })).toBe(1);
  });
});
