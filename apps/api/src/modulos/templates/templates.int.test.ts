import { randomUUID } from 'node:crypto';
import { relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import { TEMPLATES_PADRAO } from '@convergia/core/templates';
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
import { textoDoTemplate } from './templates.js';
import { escopoAgencia } from '../../base/escopo-agencia.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
let agenciaId: string;
let outraAgenciaId: string;
let appAdmin: FastifyInstance;
let appMembro: FastifyInstance;
let appOutra: FastifyInstance;

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

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `A-${sufixo}` } })).id;
  outraAgenciaId = (await prisma.agencia.create({ data: { nome: `B-${sufixo}` } })).id;
  const admin = await prisma.usuario.create({
    data: { agenciaId, nome: 'Ana', email: `ana-${sufixo}@x.com`, papel: 'admin' },
  });
  appAdmin = construir(usuarioTeste({ agenciaId, id: admin.id }));
  appMembro = construir(usuarioTeste({ agenciaId, id: 'membro', papel: 'membro' }));
  appOutra = construir(usuarioTeste({ agenciaId: outraAgenciaId, id: admin.id }));
  await Promise.all([appAdmin, appMembro, appOutra].map((a) => a.ready()));
});

afterAll(async () => {
  await Promise.all([appAdmin, appMembro, appOutra].map((a) => a.close()));
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaId, outraAgenciaId] } } });
  await prisma.$disconnect();
});

interface Visao {
  tipo: string;
  texto: string;
  personalizado: boolean;
  padrao: string;
}
const listar = async (app: FastifyInstance) =>
  (await app.inject({ url: '/templates' })).json<{ templates: Visao[] }>().templates;
const salvar = (app: FastifyInstance, tipo: string, texto: string) =>
  app.inject({ method: 'PUT', url: `/templates/${tipo}`, payload: { texto } });

describe('RN-55 templates editáveis', () => {
  it('sem edição, lista os 4 com o texto padrão da spec', async () => {
    const t = await listar(appAdmin);
    expect(t.map((x) => x.tipo)).toEqual([
      'convite',
      'confirmacao_prazo',
      'lembrete_pendencia',
      'lembrete_compromisso',
    ]);
    expect(t.every((x) => !x.personalizado)).toBe(true);
    expect(t[0]?.texto).toBe(TEMPLATES_PADRAO.convite);
  });

  it('salva o texto editado, audita, e a edição vale só para a própria agência (RN-75)', async () => {
    const texto = 'Oi {{nome_contato}}! Comece aqui: {{link_onboarding}}';
    expect((await salvar(appAdmin, 'convite', texto)).statusCode).toBe(200);
    const convite = (await listar(appAdmin)).find((x) => x.tipo === 'convite');
    expect(convite).toMatchObject({ texto, personalizado: true });
    expect((await listar(appOutra)).find((x) => x.tipo === 'convite')?.personalizado).toBe(false);
    expect(await textoDoTemplate(escopoAgencia(prisma, agenciaId), 'convite')).toBe(texto);
    expect(
      await prisma.auditoriaLog.count({ where: { agenciaId, acao: 'template.alterado' } }),
    ).toBe(1);
  });

  it('salvar de novo substitui, sem duplicar', async () => {
    await salvar(appAdmin, 'lembrete_pendencia', 'Faltam: {{pendencias}} {{link_onboarding}}');
    await salvar(appAdmin, 'lembrete_pendencia', 'Pendente: {{pendencias}} {{link_onboarding}}');
    expect(
      await prisma.templateMensagem.count({ where: { agenciaId, tipo: 'lembrete_pendencia' } }),
    ).toBe(1);
  });

  it('RN-29 recusa pedido de senha e variável desconhecida, sem salvar', async () => {
    const senha = await salvar(appAdmin, 'confirmacao_prazo', 'Mande a senha, {{nome_contato}}');
    expect(senha.statusCode).toBe(422);
    expect(senha.json()).toMatchObject({
      erro: 'TEMPLATE_INVALIDO',
      erros: [{ codigo: 'pede_senha' }],
    });
    const desconhecida = await salvar(appAdmin, 'confirmacao_prazo', 'Oi {{apelido}}');
    expect(desconhecida.json()).toMatchObject({
      erros: [{ codigo: 'variavel_desconhecida', detalhe: 'apelido' }],
    });
    expect(
      (await listar(appAdmin)).find((x) => x.tipo === 'confirmacao_prazo')?.personalizado,
    ).toBe(false);
  });

  it('restaurar padrão apaga a edição e audita', async () => {
    await salvar(appAdmin, 'lembrete_compromisso', '{{tipo}} em {{data}}. {{link_onboarding}}');
    const r = await appAdmin.inject({ method: 'DELETE', url: '/templates/lembrete_compromisso' });
    expect(r.statusCode).toBe(200);
    expect(
      (await listar(appAdmin)).find((x) => x.tipo === 'lembrete_compromisso')?.personalizado,
    ).toBe(false);
    expect(
      await prisma.auditoriaLog.count({ where: { agenciaId, acao: 'template.restaurado' } }),
    ).toBe(1);
  });

  it('a pré-visualização usa dados de exemplo e não salva', async () => {
    const r = await appAdmin.inject({
      method: 'POST',
      url: '/templates/convite/previa',
      payload: { texto: 'Oi {{nome_contato}}, entre: {{link_onboarding}}' },
    });
    expect(r.json()).toEqual({
      previa: 'Oi Maria, entre: https://exemplo.com/o/abc123',
      erros: [],
    });
    const comErro = await appAdmin.inject({
      method: 'POST',
      url: '/templates/convite/previa',
      payload: { texto: 'Oi {{x}}' },
    });
    expect(comErro.json<{ erros: unknown[] }>().erros).toHaveLength(2);
  });

  it('só o Admin edita ou vê (RN-03); tipo desconhecido é recusado', async () => {
    expect((await appMembro.inject({ url: '/templates' })).statusCode).toBe(403);
    expect((await salvar(appMembro, 'convite', 'x {{link_onboarding}}')).statusCode).toBe(403);
    expect((await salvar(appAdmin, 'outro', 'x')).statusCode).toBe(400);
  });
});
