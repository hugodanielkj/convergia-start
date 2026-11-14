import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { URL_BANCO_TESTE } from '../testes/dependencias.js';
import { sessaoDeDesenvolvimento } from './auth.js';
import { escopoAgencia } from './escopo-agencia.js';
import { criarPrisma } from './prisma.js';

// Cada teste cria as próprias agências: dados isolados, sem limpar o banco, seguro em paralelo.
const prisma = criarPrisma(URL_BANCO_TESTE);
const email = `mesmo-${randomUUID()}@exemplo.com`;
let agenciaA: string;
let agenciaB: string;
let usuarioB: string;

beforeAll(async () => {
  agenciaA = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  agenciaB = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  await prisma.usuario.create({ data: { agenciaId: agenciaA, nome: 'Ana', email } });
  usuarioB = (await prisma.usuario.create({ data: { agenciaId: agenciaB, nome: 'Bia', email } }))
    .id;
});

afterAll(async () => {
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaA, agenciaB] } } });
  await prisma.$disconnect();
});

describe('RN-75 isolamento entre agências (banco real)', () => {
  it('listagem só traz usuários da própria agência', async () => {
    const usuarios = await escopoAgencia(prisma, agenciaA).usuario.findMany({ where: { email } });
    expect(usuarios.map((u) => u.nome)).toEqual(['Ana']);
  });

  it('busca por id de outra agência não encontra nada', async () => {
    const encontrado = await escopoAgencia(prisma, agenciaA).usuario.findUnique({
      where: { id: usuarioB },
    });
    expect(encontrado).toBeNull();
  });

  it('não altera registro de outra agência', async () => {
    await expect(
      escopoAgencia(prisma, agenciaA).usuario.update({
        where: { id: usuarioB },
        data: { nome: 'Invadido' },
      }),
    ).rejects.toThrow();
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioB } })).nome).toBe('Bia');
  });

  it('criação recebe a agência do escopo', async () => {
    const criado = await escopoAgencia(prisma, agenciaA).auditoriaLog.create({
      data: { ator: 'sistema', acao: 'teste', entidade: 'Teste', entidadeId: '1' } as never,
    });
    expect(criado.agenciaId).toBe(agenciaA);
  });

  it('modelo global (Agencia) não é filtrado', async () => {
    const agencias = await escopoAgencia(prisma, agenciaA).agencia.findMany({
      where: { id: { in: [agenciaA, agenciaB] } },
    });
    expect(agencias).toHaveLength(2);
  });
});

describe('sessão de desenvolvimento', () => {
  it('resolve o usuário ativo pelo e-mail', async () => {
    const unico = `dev-${randomUUID()}@exemplo.com`;
    await prisma.usuario.create({
      data: { agenciaId: agenciaA, nome: 'Dev', email: unico, papel: 'admin' },
    });
    const usuario = await sessaoDeDesenvolvimento(prisma, unico)(undefined as never);
    expect(usuario).toMatchObject({ email: unico, agenciaId: agenciaA, papel: 'admin' });
  });

  it('retorna null para e-mail inexistente', async () => {
    expect(await sessaoDeDesenvolvimento(prisma, 'ninguem@x.com')(undefined as never)).toBeNull();
  });
});
