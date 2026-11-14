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
let appPublico: FastifyInstance;
let appAdmin: FastifyInstance;
let appResponsavel: FastifyInstance;
let appOutro: FastifyInstance;
let appOutraAgencia: FastifyInstance;

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

async function criarOnboarding(tag: string, expirado = false) {
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
          expiraEm: new Date(AGORA_TESTE.getTime() + (expirado ? -1000 : 14 * 86_400_000)),
        },
      },
    },
  });
  return { token, id: onboarding.id };
}

interface Visao {
  etapa: string;
  plataformas: {
    plataforma: string;
    obrigatoria: boolean;
    status: string;
    motivo: string | null;
    informado: boolean;
    passos: string[];
    identificador: string | null;
  }[];
}

const pub = (token: string, caminho = '') => `/publico/onboardings/${token}/acessos${caminho}`;
const lerCliente = (token: string) => appPublico.inject({ method: 'GET', url: pub(token) });
const informar = (token: string, p: string) =>
  appPublico.inject({ method: 'POST', url: pub(token, `/${p}/informar`) });
const marcar = (app: FastifyInstance, id: string, p: string, payload: object) =>
  app.inject({ method: 'PUT', url: `/onboardings/${id}/acessos/${p}`, payload });
const statusEtapa = async (id: string) =>
  (
    await prisma.etapaOnboarding.findUniqueOrThrow({
      where: { onboardingId_tipo: { onboardingId: id, tipo: 'acessos' } },
    })
  ).status;

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: 'A' } })).id;
  outraAgenciaId = (await prisma.agencia.create({ data: { nome: 'B' } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const mk = (papel: 'admin' | 'membro', nome: string) =>
    prisma.usuario.create({ data: { agenciaId, nome, email: `${nome}-${sufixo}@ag.com`, papel } });
  adminId = (await mk('admin', 'admin')).id;
  responsavelId = (await mk('membro', 'resp')).id;
  outroId = (await mk('membro', 'outro')).id;
  appPublico = construir(null);
  appAdmin = construir(usuarioTeste({ agenciaId, id: adminId }));
  appResponsavel = construir(usuarioTeste({ agenciaId, id: responsavelId, papel: 'membro' }));
  appOutro = construir(usuarioTeste({ agenciaId, id: outroId, papel: 'membro' }));
  appOutraAgencia = construir(usuarioTeste({ agenciaId: outraAgenciaId, id: adminId }));
  await Promise.all(
    [appPublico, appAdmin, appResponsavel, appOutro, appOutraAgencia].map((a) => a.ready()),
  );
});

afterAll(async () => {
  await Promise.all(
    [appPublico, appAdmin, appResponsavel, appOutro, appOutraAgencia].map((a) => a.close()),
  );
  await prisma.agencia.deleteMany({ where: { id: { in: [agenciaId, outraAgenciaId] } } });
  await prisma.$disconnect();
});

describe('S3-1 etapa de acessos do cliente (RN-22, RN-27, D-06)', () => {
  it('sem escolha, lista as plataformas padrão da agência, com passo a passo e sem senha', async () => {
    const { token } = await criarOnboarding('lista');
    const r = await lerCliente(token);
    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    const v = r.json<Visao>();
    expect(v.etapa).toBe('pendente');
    expect(v.plataformas.map((p) => [p.plataforma, p.obrigatoria])).toEqual([
      ['instagram', true],
      ['facebook', true],
    ]);
    for (const p of v.plataformas) {
      expect(p.status).toBe('pendente');
      expect(p.passos.length).toBeGreaterThan(1);
    }
    expect(JSON.stringify(v).toLowerCase()).not.toContain('senha');
  });

  it('mostra o identificador da agência quando o admin o configura (RN-22)', async () => {
    const { token } = await criarOnboarding('ident');
    const salvar = await appAdmin.inject({
      method: 'PUT',
      url: '/acessos/config',
      payload: { identificadores: { instagram: 'acesso@agencia.com', facebook: '  ' } },
    });
    expect(salvar.statusCode).toBe(200);
    const v = (await lerCliente(token)).json<Visao>();
    const insta = v.plataformas.find((p) => p.plataforma === 'instagram');
    expect(insta?.identificador).toBe('acesso@agencia.com');
    expect(insta?.passos.join(' ')).toContain('acesso@agencia.com');
    expect(v.plataformas.find((p) => p.plataforma === 'facebook')?.identificador).toBeNull();
  });

  it('só admin altera o identificador (RN-03)', async () => {
    const r = await appResponsavel.inject({
      method: 'PUT',
      url: '/acessos/config',
      payload: { identificadores: {} },
    });
    expect(r.statusCode).toBe(403);
  });

  it('cliente avisa que adicionou: etapa em andamento, ainda pendente até a agência confirmar', async () => {
    const { token, id } = await criarOnboarding('informa');
    const r = await informar(token, 'instagram');
    expect(r.statusCode).toBe(200);
    const insta = r.json<Visao>().plataformas.find((p) => p.plataforma === 'instagram');
    expect(insta).toMatchObject({ status: 'pendente', informado: true });
    expect(await statusEtapa(id)).toBe('em_andamento');
  });

  it('plataforma desconhecida e link inválido ou expirado são recusados', async () => {
    const { token } = await criarOnboarding('rec');
    expect((await informar(token, 'orkut')).statusCode).toBe(400);
    expect((await lerCliente('token-que-nao-existe')).statusCode).toBe(404);
    const expirado = await criarOnboarding('exp', true);
    expect((await lerCliente(expirado.token)).statusCode).toBe(410);
  });
});

describe('S3-2 agência marca o acesso (RN-27, RN-28, RN-77)', () => {
  it('etapa conclui só com todas as escolhidas concedidas', async () => {
    const { token, id } = await criarOnboarding('conclui');
    await lerCliente(token);
    await marcar(appAdmin, id, 'instagram', { status: 'concedido' });
    expect(await statusEtapa(id)).toBe('em_andamento');
    const r = await marcar(appResponsavel, id, 'facebook', { status: 'concedido' });
    expect(r.statusCode).toBe(200);
    expect(r.json<Visao>().etapa).toBe('concluida');
    expect(await statusEtapa(id)).toBe('concluida');
  });

  it('inválido exige motivo; o cliente vê o motivo e volta a pendente ao reinformar', async () => {
    const { token, id } = await criarOnboarding('invalido');
    const sem = await marcar(appAdmin, id, 'facebook', { status: 'invalido' });
    expect(sem.statusCode).toBe(422);
    expect(sem.json<{ erro: string }>().erro).toBe('RN-28');

    await marcar(appAdmin, id, 'facebook', { status: 'invalido', motivo: 'Página errada' });
    const visto = (await lerCliente(token)).json<Visao>();
    expect(visto.plataformas.find((p) => p.plataforma === 'facebook')).toMatchObject({
      status: 'invalido',
      motivo: 'Página errada',
    });

    const depois = (await informar(token, 'facebook')).json<Visao>();
    expect(depois.plataformas.find((p) => p.plataforma === 'facebook')).toMatchObject({
      status: 'pendente',
      motivo: null,
      informado: true,
    });
  });

  it('inválido depois de concluída reabre a etapa', async () => {
    const { token, id } = await criarOnboarding('reabre');
    await lerCliente(token);
    await marcar(appAdmin, id, 'instagram', { status: 'concedido' });
    await marcar(appAdmin, id, 'facebook', { status: 'concedido' });
    expect(await statusEtapa(id)).toBe('concluida');
    await marcar(appAdmin, id, 'facebook', { status: 'invalido', motivo: 'Perdeu o acesso' });
    expect(await statusEtapa(id)).toBe('em_andamento');
  });

  it('cliente não mexe em acesso já concedido', async () => {
    const { token, id } = await criarOnboarding('conc');
    await lerCliente(token);
    await marcar(appAdmin, id, 'instagram', { status: 'concedido' });
    await informar(token, 'instagram');
    const v = (await lerCliente(token)).json<Visao>();
    expect(v.plataformas.find((p) => p.plataforma === 'instagram')?.status).toBe('concedido');
  });

  it('registra auditoria da marcação e do aviso do cliente', async () => {
    const { token, id } = await criarOnboarding('audit');
    await informar(token, 'instagram');
    await marcar(appAdmin, id, 'instagram', { status: 'invalido', motivo: 'Sem convite' });
    const log = await prisma.auditoriaLog.findMany({
      where: { entidadeId: id },
      orderBy: { em: 'asc' },
    });
    expect(log.map((l) => [l.acao, l.ator.split(':')[0]])).toEqual([
      ['acesso.informado', 'cliente'],
      ['acesso.invalidado', 'usuario'],
    ]);
  });

  it('membro que não é o responsável não vê nem marca (RN-02); outra agência não alcança (RN-75)', async () => {
    const { token, id } = await criarOnboarding('perm');
    await lerCliente(token);
    for (const app of [appOutro, appOutraAgencia]) {
      const ler = await app.inject({ method: 'GET', url: `/onboardings/${id}/acessos` });
      expect([403, 404]).toContain(ler.statusCode);
      const m = await marcar(app, id, 'instagram', { status: 'concedido' });
      expect([403, 404]).toContain(m.statusCode);
    }
    const ok = await appResponsavel.inject({ method: 'GET', url: `/onboardings/${id}/acessos` });
    expect(ok.statusCode).toBe(200);
  });
});

describe('S6-3 plataformas escolhidas por cliente (RN-27)', () => {
  interface Escolha {
    plataformas: { plataforma: string; escolhida: boolean }[];
    travada: boolean;
  }
  const url = (id: string) => `/onboardings/${id}/acessos/escolha`;
  const escolher = (app: FastifyInstance, id: string, plataformas: string[]) =>
    app.inject({ method: 'PUT', url: url(id), payload: { plataformas } });
  const marcadas = (e: Escolha) =>
    e.plataformas.filter((p) => p.escolhida).map((p) => p.plataforma);

  it('o cadastro parte das plataformas da config da agência', async () => {
    const r = await appOutro.inject({ method: 'GET', url: '/acessos/padrao' });
    expect(r.statusCode).toBe(200);
    expect(marcadas(r.json<Escolha>())).toEqual(['instagram', 'facebook']);
  });

  it('pode desmarcar Instagram e Facebook; o cliente só vê as escolhidas', async () => {
    const { token, id } = await criarOnboarding('esc1');
    const r = await escolher(appAdmin, id, ['tiktok', 'google']);
    expect(r.statusCode).toBe(200);
    expect(marcadas(r.json<Escolha>())).toEqual(['tiktok', 'google']);
    const v = (await lerCliente(token)).json<Visao>();
    expect(v.plataformas.map((p) => p.plataforma)).toEqual(['tiktok', 'google']);
    expect((await informar(token, 'instagram')).statusCode).toBe(404);
  });

  it('a etapa conclui quando todas as escolhidas estão concedidas', async () => {
    const { id } = await criarOnboarding('esc2');
    await escolher(appAdmin, id, ['tiktok']);
    const r = await marcar(appAdmin, id, 'tiktok', { status: 'concedido' });
    expect(r.json<Visao>().etapa).toBe('concluida');
    expect(await statusEtapa(id)).toBe('concluida');
  });

  it('exige pelo menos uma plataforma', async () => {
    const { id } = await criarOnboarding('esc3');
    const r = await escolher(appAdmin, id, []);
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erro: string }>().erro).toBe('RN-27');
  });

  it('trava quando o cliente avisa em alguma plataforma (409)', async () => {
    const { token, id } = await criarOnboarding('esc4');
    await informar(token, 'instagram');
    const r = await escolher(appAdmin, id, ['tiktok']);
    expect(r.statusCode).toBe(409);
    expect(r.json<{ erro: string }>().erro).toBe('ESCOLHA_TRAVADA');
  });

  it('trava quando a agência marca alguma como concedida ou inválida', async () => {
    const { id } = await criarOnboarding('esc5');
    await marcar(appAdmin, id, 'facebook', { status: 'invalido', motivo: 'Página errada' });
    expect((await appAdmin.inject({ method: 'GET', url: url(id) })).json<Escolha>().travada).toBe(
      true,
    );
    expect((await escolher(appAdmin, id, ['facebook'])).statusCode).toBe(409);
  });

  it('responsável escolhe; outro membro não (RN-02); fica na auditoria (RN-77)', async () => {
    const { id } = await criarOnboarding('esc6');
    expect((await escolher(appOutro, id, ['google'])).statusCode).toBe(403);
    expect((await escolher(appResponsavel, id, ['google'])).statusCode).toBe(200);
    const log = await prisma.auditoriaLog.findFirst({
      where: { entidadeId: id, acao: 'acessos.escolhidos' },
    });
    expect(log?.dados).toEqual({ plataformas: 'google' });
  });
});
