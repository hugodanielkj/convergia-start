import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import { TERMO_ATUAL } from '@convergia/core/consentimento';
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
const MS_DIA = 24 * 60 * 60 * 1000;
let agenciaId: string;
let adminId: string;
let responsavelId: string;
let outroId: string;
let appPublico: FastifyInstance;
let appAdmin: FastifyInstance;
let appOutro: FastifyInstance;

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

async function criarOnboarding(
  tag: string,
  opcoes: { consentimento?: boolean; expirado?: boolean } = {},
) {
  const { token, hash } = gerarTokenLink();
  const cliente = await prisma.cliente.create({
    data: {
      agenciaId,
      nomeEmpresa: `Empresa ${tag}`,
      nomeContato: 'C',
      email: `${tag}-${sufixo}@x.com`,
    },
  });
  const onboarding = await prisma.onboarding.create({
    data: {
      agenciaId,
      clienteId: cliente.id,
      responsavelId,
      etapas: {
        create: ['formulario', 'acessos', 'reuniao', 'captacao'].map((tipo) => ({
          agenciaId,
          tipo: tipo as 'formulario',
        })),
      },
      link: {
        create: {
          agenciaId,
          tokenHash: hash,
          expiraEm: new Date(AGORA_TESTE.getTime() + (opcoes.expirado ? -1000 : 14 * MS_DIA)),
        },
      },
    },
  });
  if (opcoes.consentimento !== false) {
    await prisma.consentimentoCliente.create({
      data: {
        agenciaId,
        onboardingId: onboarding.id,
        versaoTermo: TERMO_ATUAL.versao,
        aceitoEm: AGORA_TESTE,
      },
    });
  }
  return { token, onboardingId: onboarding.id, clienteId: cliente.id };
}

const base = (token: string) => `/publico/onboardings/${token}/formulario`;
const ler = (token: string) => appPublico.inject({ method: 'GET', url: base(token) });
const rascunho = (token: string, respostas: unknown) =>
  appPublico.inject({ method: 'PUT', url: `${base(token)}/rascunho`, payload: { respostas } });
const enviar = (token: string, respostas: unknown) =>
  appPublico.inject({ method: 'POST', url: `${base(token)}/enviar`, payload: { respostas } });

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const mk = (papel: 'admin' | 'membro', nome: string) =>
    prisma.usuario.create({ data: { agenciaId, nome, email: `${nome}-${sufixo}@ag.com`, papel } });
  adminId = (await mk('admin', 'admin')).id;
  responsavelId = (await mk('membro', 'resp')).id;
  outroId = (await mk('membro', 'outro')).id;
  appPublico = construir(null);
  appAdmin = construir(usuarioTeste({ agenciaId, id: adminId }));
  appOutro = construir(usuarioTeste({ agenciaId, id: outroId, papel: 'membro' }));
  await Promise.all([appPublico.ready(), appAdmin.ready(), appOutro.ready()]);
});

afterAll(async () => {
  await Promise.all([appPublico.close(), appAdmin.close(), appOutro.close()]);
  await prisma.agencia.delete({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

let appResp: FastifyInstance;

const url = (onboardingId: string) => `/onboardings/${onboardingId}/formulario/personalizacao`;
interface Estado {
  personalizada: boolean;
  versao: number | null;
  versaoPadrao: number;
  campos: { chave: string; rotulo: string; tipo: string; obrigatorio: boolean }[];
  travada: boolean;
}
const lerPers = async (app: FastifyInstance, onboardingId: string) =>
  app.inject({ method: 'GET', url: url(onboardingId) });
const salvarPers = (app: FastifyInstance, onboardingId: string, campos: unknown) =>
  app.inject({ method: 'PUT', url: url(onboardingId), payload: { campos } });

/** Perguntas do cliente: só duas obrigatórias do padrão e uma nova. */
async function personalizar(onboardingId: string) {
  const atual = (await lerPers(appAdmin, onboardingId)).json<Estado>();
  const mantidas = atual.campos.filter((c) => ['nome_empresa', 'segmento'].includes(c.chave));
  return salvarPers(appAdmin, onboardingId, [
    ...mantidas,
    { rotulo: 'Qual o sabor mais vendido?', tipo: 'texto_curto', obrigatorio: true },
  ]);
}

beforeAll(async () => {
  appResp = construir(usuarioTeste({ agenciaId, id: responsavelId, papel: 'membro' }));
  await appResp.ready();
});

afterAll(async () => {
  await appResp.close();
});

describe('RN-15 personalização das perguntas por cliente', () => {
  it('sem personalização, parte dos campos ativos do modelo padrão', async () => {
    const { onboardingId } = await criarOnboarding('p1');
    const r = await lerPers(appAdmin, onboardingId);
    expect(r.statusCode).toBe(200);
    const e = r.json<Estado>();
    expect(e.personalizada).toBe(false);
    expect(e.travada).toBe(false);
    expect(e.campos.map((c) => c.chave)).toContain('nome_empresa');
  });

  it('salva uma versão do cliente sem mudar o modelo padrão', async () => {
    const { onboardingId, token } = await criarOnboarding('p2');
    const antes = (await appAdmin.inject({ method: 'GET', url: '/formulario/modelo' })).json<{
      versaoPublicada: { numero: number; campos: unknown[] };
    }>();

    const r = await personalizar(onboardingId);
    expect(r.statusCode).toBe(201);
    const e = r.json<Estado>();
    expect(e).toMatchObject({ personalizada: true, versao: 1 });
    expect(e.campos.map((c) => c.chave)).toEqual([
      'nome_empresa',
      'segmento',
      'qual_o_sabor_mais_vendido',
    ]);

    const depois = (await appAdmin.inject({ method: 'GET', url: '/formulario/modelo' })).json<{
      versaoPublicada: { numero: number; campos: unknown[] };
    }>();
    expect(depois.versaoPublicada).toEqual(antes.versaoPublicada);

    // O cliente vê só as perguntas dele.
    const visao = (await ler(token)).json<{ versao: number; campos: { chave: string }[] }>();
    expect(visao.campos.map((c) => c.chave)).toEqual([
      'nome_empresa',
      'segmento',
      'qual_o_sabor_mais_vendido',
    ]);
  });

  it('cada gravação cria uma versão nova e guarda o histórico', async () => {
    const { onboardingId } = await criarOnboarding('p3');
    await personalizar(onboardingId);
    const atual = (await lerPers(appAdmin, onboardingId)).json<Estado>();
    const r = await salvarPers(appAdmin, onboardingId, [
      ...atual.campos,
      { rotulo: 'Instagram', tipo: 'url', obrigatorio: false },
    ]);
    expect(r.json<Estado>().versao).toBe(2);
    const versoes = await prisma.versaoFormularioCliente.findMany({
      where: { onboardingId },
      orderBy: { numero: 'asc' },
    });
    expect(versoes.map((v) => v.numero)).toEqual([1, 2]);
  });

  it('salvar sem mudanças não cria versão', async () => {
    const { onboardingId } = await criarOnboarding('p4');
    const atual = (await lerPers(appAdmin, onboardingId)).json<Estado>();
    const r = await salvarPers(appAdmin, onboardingId, atual.campos);
    expect(r.statusCode).toBe(200);
    expect(await prisma.versaoFormularioCliente.count({ where: { onboardingId } })).toBe(0);
  });

  it('recusa personalização inválida (sem perguntas)', async () => {
    const { onboardingId } = await criarOnboarding('p5');
    const r = await salvarPers(appAdmin, onboardingId, []);
    expect(r.statusCode).toBe(422);
  });

  it('a resposta fica presa à versão do cliente e o envio exige as perguntas dele', async () => {
    const { onboardingId, token } = await criarOnboarding('p6');
    await personalizar(onboardingId);
    const semNova = await enviar(token, { nome_empresa: 'Padaria', segmento: 'Pães' });
    expect(semNova.statusCode).toBe(422);
    const ok = await enviar(token, {
      nome_empresa: 'Padaria',
      segmento: 'Pães',
      qual_o_sabor_mais_vendido: 'Pão de queijo',
    });
    expect(ok.statusCode).toBe(200);
    const resposta = await prisma.respostaFormulario.findUniqueOrThrow({
      where: { onboardingId },
      include: { versaoCliente: true },
    });
    expect(resposta.versaoCliente?.numero).toBe(1);
  });

  it('rascunho vazio não trava e acompanha a personalização feita depois', async () => {
    const { onboardingId, token } = await criarOnboarding('p7');
    await rascunho(token, { nome_empresa: '   ' });
    const r = await personalizar(onboardingId);
    expect(r.statusCode).toBe(201);
    await rascunho(token, { nome_empresa: 'Padaria' });
    const resposta = await prisma.respostaFormulario.findUniqueOrThrow({
      where: { onboardingId },
    });
    expect(resposta.versaoClienteId).not.toBeNull();
  });

  it('trava no primeiro rascunho com resposta (409)', async () => {
    const { onboardingId, token } = await criarOnboarding('p8');
    await rascunho(token, { nome_empresa: 'Padaria' });
    expect((await lerPers(appAdmin, onboardingId)).json<Estado>().travada).toBe(true);
    const r = await personalizar(onboardingId);
    expect(r.statusCode).toBe(409);
    expect(r.json<{ erro: string }>().erro).toBe('PERSONALIZACAO_TRAVADA');
  });

  it('o responsável pode personalizar; outro membro não (RN-02)', async () => {
    const { onboardingId } = await criarOnboarding('p9');
    expect((await lerPers(appResp, onboardingId)).statusCode).toBe(200);
    expect((await lerPers(appOutro, onboardingId)).statusCode).toBe(403);
  });

  it('qualquer usuário lê o ponto de partida do cadastro', async () => {
    const r = await appOutro.inject({ method: 'GET', url: '/formulario/padrao' });
    expect(r.statusCode).toBe(200);
    expect(r.json<{ campos: { chave: string }[] }>().campos.length).toBeGreaterThan(0);
  });

  it('registra a personalização na auditoria (RN-77)', async () => {
    const { onboardingId } = await criarOnboarding('p10');
    await personalizar(onboardingId);
    const log = await prisma.auditoriaLog.findFirst({
      where: { agenciaId, acao: 'formulario.personalizado', entidadeId: onboardingId },
    });
    expect(log).not.toBeNull();
  });
});
