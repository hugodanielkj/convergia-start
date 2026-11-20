import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo } from '@convergia/core/base';
import { extrairConfigGeral } from '@convergia/core/config';
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
let adminId: string;
let appAdmin: FastifyInstance;
let appMembro: FastifyInstance;

const construir = (id: string, papel: 'admin' | 'membro') =>
  construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuarioTeste({ agenciaId, id, papel })),
    }),
  );

const padrao = () => extrairConfigGeral(`Agência ${sufixo}`, CONFIG_PADRAO);

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `Agência ${sufixo}` } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  adminId = (
    await prisma.usuario.create({
      data: { agenciaId, nome: 'Ana', email: `ana-${sufixo}@x.com`, papel: 'admin' },
    })
  ).id;
  appAdmin = construir(adminId, 'admin');
  appMembro = construir(randomUUID(), 'membro');
  await Promise.all([appAdmin.ready(), appMembro.ready()]);
});

afterAll(async () => {
  await Promise.all([appAdmin.close(), appMembro.close()]);
  await prisma.agencia.deleteMany({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('RN-03 configurações gerais só para o Admin', () => {
  it('membro recebe 403 ao ler e ao salvar', async () => {
    expect((await appMembro.inject({ method: 'GET', url: '/config/geral' })).statusCode).toBe(403);
    const r = await appMembro.inject({ method: 'PUT', url: '/config/geral', payload: padrao() });
    expect(r.statusCode).toBe(403);
  });

  it('o Admin lê o nome da agência e os valores atuais', async () => {
    const r = await appAdmin.inject({ method: 'GET', url: '/config/geral' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      config: padrao(),
      limites: { prazoProducaoDiasUteis: { min: 1, max: 30 } },
      nomeMax: 80,
    });
  });
});

describe('RN-03 salvar com limites e auditoria (RN-77)', () => {
  it('salva, devolve os valores e audita só o que mudou', async () => {
    const nova = {
      ...padrao(),
      nomeAgencia: '  Convergia Digital ',
      prazoProducaoDiasUteis: 7,
      canalNotificacaoPadrao: 'email' as const,
    };
    const r = await appAdmin.inject({ method: 'PUT', url: '/config/geral', payload: nova });
    expect(r.statusCode).toBe(200);
    expect(r.json<{ config: { nomeAgencia: string } }>().config.nomeAgencia).toBe(
      'Convergia Digital',
    );

    const config = await prisma.configAgencia.findUniqueOrThrow({ where: { agenciaId } });
    expect(config.prazoProducaoDiasUteis).toBe(7);
    expect(config.canalNotificacaoPadrao).toBe('email');
    const agencia = await prisma.agencia.findUniqueOrThrow({ where: { id: agenciaId } });
    expect(agencia.nome).toBe('Convergia Digital');

    const auditoria = await prisma.auditoriaLog.findFirst({
      where: { agenciaId, acao: 'config.geral_alterada' },
      orderBy: { em: 'desc' },
    });
    expect(auditoria?.ator).toBe(`usuario:${adminId}`);
    expect(auditoria?.dados).toEqual({
      nomeAgencia: `Agência ${sufixo} → Convergia Digital`,
      prazoProducaoDiasUteis: '5 → 7',
      canalNotificacaoPadrao: 'whatsapp → email',
    });
  });

  it('recusa valor fora do limite com 422 e não grava nada', async () => {
    const antes = await prisma.configAgencia.findUniqueOrThrow({ where: { agenciaId } });
    const r = await appAdmin.inject({
      method: 'PUT',
      url: '/config/geral',
      payload: { ...padrao(), validadeLinkDias: 91, duracaoReuniaoMinutos: 10 },
    });
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erros: { campo: string }[] }>().erros.map((e) => e.campo)).toEqual([
      'validadeLinkDias',
      'duracaoReuniaoMinutos',
    ]);
    const depois = await prisma.configAgencia.findUniqueOrThrow({ where: { agenciaId } });
    expect(depois).toEqual(antes);
  });

  it('sem mudança, não grava auditoria nova', async () => {
    const atual = (await appAdmin.inject({ method: 'GET', url: '/config/geral' })).json<{
      config: object;
    }>().config;
    const antes = await prisma.auditoriaLog.count({
      where: { agenciaId, acao: 'config.geral_alterada' },
    });
    await appAdmin.inject({ method: 'PUT', url: '/config/geral', payload: atual });
    const depois = await prisma.auditoriaLog.count({
      where: { agenciaId, acao: 'config.geral_alterada' },
    });
    expect(depois).toBe(antes);
  });
});

describe('RN-27 plataformas marcadas por padrão', () => {
  it('o Admin lê e salva as plataformas padrão junto com os identificadores', async () => {
    const lido = await appAdmin.inject({ method: 'GET', url: '/acessos/config' });
    expect(lido.json<{ plataformasPadrao: string[] }>().plataformasPadrao).toEqual([
      'instagram',
      'facebook',
    ]);
    const r = await appAdmin.inject({
      method: 'PUT',
      url: '/acessos/config',
      payload: { identificadores: {}, plataformasPadrao: ['tiktok', 'instagram'] },
    });
    expect(r.statusCode).toBe(200);
    const config = await prisma.configAgencia.findUniqueOrThrow({ where: { agenciaId } });
    expect(config.plataformasObrigatorias).toEqual(['instagram', 'tiktok']);
    const padraoCadastro = await appAdmin.inject({ method: 'GET', url: '/acessos/padrao' });
    expect(JSON.stringify(padraoCadastro.json())).toContain('tiktok');
    const auditoria = await prisma.auditoriaLog.findFirst({
      where: { agenciaId, acao: 'config.plataformas_padrao_alteradas' },
    });
    expect(auditoria?.dados).toEqual({ antes: 'instagram, facebook', depois: 'instagram, tiktok' });
  });

  it('exige pelo menos uma plataforma', async () => {
    const r = await appAdmin.inject({
      method: 'PUT',
      url: '/acessos/config',
      payload: { identificadores: {}, plataformasPadrao: [] },
    });
    expect(r.statusCode).toBe(422);
  });
});
