import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO } from '@convergia/core/base';
import { hashToken } from '@convergia/core/link';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../app.js';
import { criarPrisma } from '../../base/prisma.js';
import { URL_BANCO_TESTE, dependenciasDeTeste, usuarioTeste } from '../../testes/dependencias.js';
import { enviarFormulario } from '../../testes/liberacao.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
let agenciaId: string;
let appAdmin: FastifyInstance;
let appPublico: FastifyInstance;

let n = 0;
async function novoCliente(): Promise<{ token: string; onboardingId: string }> {
  n += 1;
  const r = await appAdmin.inject({
    method: 'POST',
    url: '/clientes',
    payload: {
      nomeEmpresa: `Resumo ${String(n)}`,
      nomeContato: 'C',
      email: `r${String(n)}-${sufixo}@t.com`,
    },
  });
  const { token } = r.json<{ link: { token: string } }>().link;
  const link = await prisma.linkOnboarding.findUniqueOrThrow({
    where: { tokenHash: hashToken(token) },
  });
  return { token, onboardingId: link.onboardingId };
}

/** Onboarding percorrido até o fim, com as datas de cada passo. */
async function concluir(token: string, onboardingId: string): Promise<void> {
  await enviarFormulario(prisma, token);
  await prisma.respostaFormulario.update({
    where: { onboardingId },
    data: {
      respostas: { segredo: 'não aparece no resumo' },
      enviadaEm: new Date('2026-11-10T13:00:00Z'),
    },
  });
  await prisma.acessoPlataforma.createMany({
    data: ['instagram', 'facebook'].map((plataforma) => ({
      agenciaId,
      onboardingId,
      plataforma,
      status: 'concedido' as const,
      atualizadoEm: new Date('2026-11-11T12:00:00Z'),
    })),
  });
  await prisma.agendamento.createMany({
    data: [
      {
        agenciaId,
        onboardingId,
        tipo: 'reuniao' as const,
        inicio: new Date('2026-11-12T17:00:00Z'),
        fim: new Date('2026-11-12T18:00:00Z'),
        status: 'realizado' as const,
      },
      // Um horário cancelado não entra no resumo.
      {
        agenciaId,
        onboardingId,
        tipo: 'captacao' as const,
        inicio: new Date('2026-11-13T12:00:00Z'),
        fim: new Date('2026-11-13T15:00:00Z'),
        status: 'cancelado' as const,
      },
      {
        agenciaId,
        onboardingId,
        tipo: 'captacao' as const,
        inicio: new Date('2026-11-14T12:00:00Z'),
        fim: new Date('2026-11-14T15:00:00Z'),
        status: 'realizado' as const,
      },
    ],
  });
  await prisma.transicaoStatus.createMany({
    data: [
      {
        agenciaId,
        onboardingId,
        de: 'em_producao' as const,
        para: 'primeiro_conteudo_entregue' as const,
        ator: 'usuario:x',
        em: new Date('2026-11-20T12:00:00Z'),
      },
      {
        agenciaId,
        onboardingId,
        de: 'primeiro_conteudo_entregue' as const,
        para: 'concluido' as const,
        ator: 'usuario:x',
        em: new Date('2026-11-22T12:00:00Z'),
      },
    ],
  });
  await prisma.onboarding.update({
    where: { id: onboardingId },
    data: { statusGeral: 'concluido' },
  });
}

const resumo = (token: string) =>
  appPublico.inject({ method: 'GET', url: `/publico/onboardings/${token}/resumo` });

beforeAll(async () => {
  const agencia = await prisma.agencia.create({ data: { nome: `Agência resumo ${sufixo}` } });
  agenciaId = agencia.id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const usuario = await prisma.usuario.create({
    data: { agenciaId, nome: 'Admin', email: `admin-resumo-${sufixo}@t.com`, papel: 'admin' },
  });
  appAdmin = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      resolverSessao: () =>
        Promise.resolve(usuarioTeste({ id: usuario.id, agenciaId, email: usuario.email })),
    }),
  );
  appPublico = construirApp({ LOG_LEVEL: 'silent' }, dependenciasDeTeste({ prisma }));
  await Promise.all([appAdmin.ready(), appPublico.ready()]);
});

afterAll(async () => {
  await appAdmin.close();
  await appPublico.close();
  await prisma.agencia.delete({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('RN-14 resumo do onboarding concluído', () => {
  it('mostra as 4 etapas com data, a entrega do primeiro conteúdo e o encerramento', async () => {
    const { token, onboardingId } = await novoCliente();
    await concluir(token, onboardingId);

    const r = await resumo(token);

    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.json()).toEqual({
      empresa: `Resumo ${String(n)}`,
      fuso: 'America/Sao_Paulo',
      etapas: [
        { etapa: 'formulario', em: '2026-11-10T13:00:00.000Z' },
        { etapa: 'acessos', em: '2026-11-11T12:00:00.000Z' },
        { etapa: 'reuniao', em: '2026-11-12T17:00:00.000Z' },
        { etapa: 'captacao', em: '2026-11-14T12:00:00.000Z' },
      ],
      primeiroConteudoEm: '2026-11-20T12:00:00.000Z',
      concluidoEm: '2026-11-22T12:00:00.000Z',
    });
  });

  it('não expõe respostas do formulário nem arquivos', async () => {
    const { token, onboardingId } = await novoCliente();
    await concluir(token, onboardingId);

    const corpo = (await resumo(token)).body;

    expect(corpo).not.toContain('não aparece no resumo');
    expect(corpo).not.toContain('respostas');
  });

  it('vale mesmo com o link vencido', async () => {
    const { token, onboardingId } = await novoCliente();
    await concluir(token, onboardingId);
    await prisma.linkOnboarding.update({
      where: { onboardingId },
      data: { expiraEm: new Date('2020-01-01T00:00:00Z') },
    });

    expect((await resumo(token)).statusCode).toBe(200);
  });

  it('responde 409 enquanto o onboarding não foi concluído', async () => {
    const { token } = await novoCliente();

    const r = await resumo(token);

    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ erro: 'NAO_CONCLUIDO' });
  });

  it('token errado ou onboarding cancelado dão 404, sem revelar qual', async () => {
    const { token, onboardingId } = await novoCliente();
    await prisma.onboarding.update({
      where: { id: onboardingId },
      data: { statusGeral: 'cancelado' },
    });

    const cancelado = await resumo(token);
    const errado = await resumo('token-que-nao-existe');

    expect(cancelado.statusCode).toBe(404);
    expect(errado.statusCode).toBe(404);
    expect(cancelado.body).toBe(errado.body);
  });

  it('recusa qualquer alteração pelo link depois da conclusão (422 RN-14)', async () => {
    const { token, onboardingId } = await novoCliente();
    await concluir(token, onboardingId);

    const tentativas = await Promise.all([
      appPublico.inject({
        method: 'PUT',
        url: `/publico/onboardings/${token}/formulario/rascunho`,
        payload: { respostas: {} },
      }),
      appPublico.inject({
        method: 'POST',
        url: `/publico/onboardings/${token}/acessos/instagram/informar`,
      }),
      appPublico.inject({
        method: 'POST',
        url: `/publico/onboardings/${token}/agendamentos`,
        payload: { tipo: 'captacao', inicio: '2026-12-01T15:00:00.000Z' },
      }),
    ]);

    for (const t of tentativas) {
      expect(t.statusCode).toBe(422);
      expect(t.json()).toMatchObject({ erro: 'RN-14' });
    }
  });

  it('enquanto não conclui, as alterações seguem as regras de sempre', async () => {
    const { token } = await novoCliente();

    const r = await appPublico.inject({
      method: 'POST',
      url: `/publico/onboardings/${token}/abrir`,
    });

    expect(r.statusCode).not.toBe(422);
  });
});
