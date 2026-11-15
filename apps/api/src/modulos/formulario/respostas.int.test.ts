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
const etapa = async (onboardingId: string) =>
  (
    await prisma.etapaOnboarding.findUniqueOrThrow({
      where: { onboardingId_tipo: { onboardingId, tipo: 'formulario' } },
    })
  ).status;

const OBRIGATORIOS = {
  nome_empresa: 'Padaria Pão Quente',
  segmento: 'Alimentação',
  contato_aprovacao: 'Maria, 31 99999-8888',
};

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

describe('RN-15 o cliente responde a versão do modelo vigente', () => {
  it('mostra os campos ativos da versão publicada, sem respostas ainda', async () => {
    const { token } = await criarOnboarding('a');
    const r = await ler(token);
    expect(r.statusCode).toBe(200);
    const corpo = r.json<{
      versao: number;
      campos: { chave: string }[];
      respostas: object;
      situacao: string;
    }>();
    expect(corpo.versao).toBe(1);
    expect(corpo.campos.map((c) => c.chave)).toContain('nome_empresa');
    expect(corpo.respostas).toEqual({});
    expect(corpo.situacao).toBe('rascunho');
  });

  it('continua na versão em que começou, mesmo que a agência publique outra', async () => {
    const { token, onboardingId } = await criarOnboarding('b');
    await rascunho(token, { nome_empresa: 'Padaria' });

    const modelo = (await appAdmin.inject({ method: 'GET', url: '/formulario/modelo' })).json<{
      rascunho: { chave: string }[];
    }>();
    const novo = modelo.rascunho.map((c) =>
      c.chave === 'concorrentes' ? { ...c, arquivado: true } : c,
    );
    await appAdmin.inject({
      method: 'PUT',
      url: '/formulario/modelo/rascunho',
      payload: { campos: novo },
    });
    await appAdmin.inject({ method: 'POST', url: '/formulario/modelo/publicar' });

    const antigo = (await ler(token)).json<{ versao: number; campos: { chave: string }[] }>();
    expect(antigo.versao).toBe(1);
    expect(antigo.campos.map((c) => c.chave)).toContain('concorrentes');
    const resposta = await prisma.respostaFormulario.findUniqueOrThrow({ where: { onboardingId } });
    expect(
      (await prisma.versaoFormulario.findUniqueOrThrow({ where: { id: resposta.versaoId } }))
        .numero,
    ).toBe(1);

    const outro = await criarOnboarding('b2');
    const novoCliente = (await ler(outro.token)).json<{
      versao: number;
      campos: { chave: string }[];
    }>();
    expect(novoCliente.versao).toBe(2);
    expect(novoCliente.campos.map((c) => c.chave)).not.toContain('concorrentes');
  });
});

describe('RN-18 rascunho automático', () => {
  it('guarda o parcial, devolve igual ao reabrir e põe a etapa em andamento', async () => {
    const { token, onboardingId } = await criarOnboarding('c');
    expect(await etapa(onboardingId)).toBe('pendente');
    const r = await rascunho(token, { nome_empresa: 'Padaria', sobre: 'x' });
    expect(r.statusCode).toBe(422); // "sobre" não existe no modelo padrão
    expect((await rascunho(token, { nome_empresa: 'Padaria' })).statusCode).toBe(200);

    const reaberto = (await ler(token)).json<{ respostas: object }>();
    expect(reaberto.respostas).toEqual({ nome_empresa: 'Padaria' });
    expect(await etapa(onboardingId)).toBe('em_andamento');
  });

  it('salvar de novo substitui o rascunho anterior', async () => {
    const { token } = await criarOnboarding('d');
    await rascunho(token, { nome_empresa: 'A', segmento: 'B' });
    await rascunho(token, { nome_empresa: 'A2' });
    expect((await ler(token)).json<{ respostas: object }>().respostas).toEqual({
      nome_empresa: 'A2',
    });
  });

  it('recusa valor inválido já no rascunho, indicando o campo', async () => {
    const { token } = await criarOnboarding('e');
    const r = await rascunho(token, { redes_sociais: 5 });
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erros: unknown[] }>().erros).toEqual([
      { chave: 'redes_sociais', codigo: 'tipo_invalido' },
    ]);
  });
});

describe('RN-17 envio só com obrigatórios válidos', () => {
  it('recusa o envio incompleto e mantém a etapa como estava', async () => {
    const { token, onboardingId } = await criarOnboarding('f');
    const r = await enviar(token, { nome_empresa: 'Padaria' });
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erros: unknown[] }>().erros).toEqual([
      { chave: 'segmento', codigo: 'obrigatorio' },
      { chave: 'contato_aprovacao', codigo: 'obrigatorio' },
    ]);
    expect(await etapa(onboardingId)).toBe('pendente');
  });

  it('envio completo conclui a etapa, audita e mostra como enviado', async () => {
    const { token, onboardingId } = await criarOnboarding('g');
    const r = await enviar(token, OBRIGATORIOS);
    expect(r.statusCode).toBe(200);
    expect(await etapa(onboardingId)).toBe('concluida');
    const estado = (await ler(token)).json<{ situacao: string; editavel: boolean }>();
    expect(estado).toMatchObject({ situacao: 'enviado', editavel: true });
    const log = await prisma.auditoriaLog.findMany({
      where: { agenciaId, acao: 'formulario.enviado', entidadeId: onboardingId },
    });
    expect(log).toHaveLength(1);
    expect(log[0]?.ator).toBe(`cliente:${onboardingId}`);
  });

  it('depois de enviado não aceita mais rascunho (usa o envio para editar)', async () => {
    const { token } = await criarOnboarding('h');
    await enviar(token, OBRIGATORIOS);
    expect((await rascunho(token, { nome_empresa: 'Outro' })).statusCode).toBe(409);
  });
});

describe('RN-21 edição depois do envio', () => {
  it('permite editar, audita só os campos alterados (sem os valores) e mantém concluída', async () => {
    const { token, onboardingId } = await criarOnboarding('i');
    await enviar(token, OBRIGATORIOS);
    const r = await enviar(token, { ...OBRIGATORIOS, segmento: 'Padaria artesanal' });
    expect(r.statusCode).toBe(200);
    expect(await etapa(onboardingId)).toBe('concluida');
    const log = await prisma.auditoriaLog.findMany({
      where: { agenciaId, acao: 'formulario.editado', entidadeId: onboardingId },
    });
    expect(log).toHaveLength(1);
    expect(log[0]?.dados).toEqual({ campos: 'segmento' });
    expect(JSON.stringify(log[0]?.dados)).not.toContain('artesanal');
  });

  it('reenviar sem mudar nada não gera auditoria', async () => {
    const { token, onboardingId } = await criarOnboarding('j');
    await enviar(token, OBRIGATORIOS);
    await enviar(token, OBRIGATORIOS);
    expect(
      await prisma.auditoriaLog.count({
        where: { agenciaId, acao: 'formulario.editado', entidadeId: onboardingId },
      }),
    ).toBe(0);
  });

  it('a edição também exige os obrigatórios', async () => {
    const { token } = await criarOnboarding('k');
    await enviar(token, OBRIGATORIOS);
    expect((await enviar(token, { nome_empresa: 'Só isso' })).statusCode).toBe(422);
  });

  it('a agência fecha o formulário e o cliente não edita mais', async () => {
    const { token, onboardingId } = await criarOnboarding('l');
    await enviar(token, OBRIGATORIOS);
    const fechar = await appAdmin.inject({
      method: 'POST',
      url: `/onboardings/${onboardingId}/formulario/fechar`,
    });
    expect(fechar.statusCode).toBe(200);
    const r = await enviar(token, { ...OBRIGATORIOS, segmento: 'Mudou' });
    expect(r.statusCode).toBe(409);
    expect(r.json<{ erro: string }>().erro).toBe('FORMULARIO_FECHADO');
    expect((await ler(token)).json<{ situacao: string; editavel: boolean }>()).toMatchObject({
      situacao: 'fechado',
      editavel: false,
    });
    expect(
      await prisma.auditoriaLog.count({
        where: { agenciaId, acao: 'formulario.fechado', entidadeId: onboardingId },
      }),
    ).toBe(1);
  });

  it('a edição fecha quando a reunião acontece', async () => {
    const { token, onboardingId } = await criarOnboarding('m');
    await enviar(token, OBRIGATORIOS);
    await prisma.etapaOnboarding.update({
      where: { onboardingId_tipo: { onboardingId, tipo: 'reuniao' } },
      data: { status: 'concluida' },
    });
    expect((await enviar(token, { ...OBRIGATORIOS, segmento: 'Mudou' })).statusCode).toBe(409);
  });

  it('só dá para fechar formulário já enviado, e só o admin ou o responsável', async () => {
    const { token, onboardingId } = await criarOnboarding('n');
    const url = `/onboardings/${onboardingId}/formulario/fechar`;
    expect((await appAdmin.inject({ method: 'POST', url })).statusCode).toBe(422);
    await enviar(token, OBRIGATORIOS);
    expect((await appOutro.inject({ method: 'POST', url })).statusCode).toBe(403);
  });
});

describe('RN-72 e links', () => {
  it('sem consentimento o formulário não abre nem grava', async () => {
    const { token } = await criarOnboarding('o', { consentimento: false });
    expect((await ler(token)).statusCode).toBe(409);
    expect((await rascunho(token, { nome_empresa: 'x' })).statusCode).toBe(409);
    expect((await enviar(token, OBRIGATORIOS)).statusCode).toBe(409);
  });

  it('link inválido ou expirado não alcança o formulário', async () => {
    expect((await ler('nao-existe')).statusCode).toBe(404);
    const { token } = await criarOnboarding('p', { expirado: true });
    expect((await ler(token)).statusCode).toBe(410);
    expect((await enviar(token, OBRIGATORIA_VAZIA)).statusCode).toBe(410);
  });
});
const OBRIGATORIA_VAZIA = {};

describe('sem envio de arquivos pelo link (decisão 2026-11-14-a-sem-envio-de-arquivos)', () => {
  it('a rota de envio não existe e o formulário padrão não pede logo', async () => {
    const { token } = await criarOnboarding('q');
    const r = await appPublico.inject({
      method: 'POST',
      url: `/publico/onboardings/${token}/arquivos`,
      payload: {},
    });
    expect(r.statusCode).toBe(404);
    const envio = await enviar(token, { ...OBRIGATORIOS, logo: 'qualquer' });
    expect(envio.statusCode).toBe(422);
    expect(envio.json<{ erros: unknown[] }>().erros).toEqual([
      { chave: 'logo', codigo: 'campo_desconhecido' },
    ]);
  });
});
