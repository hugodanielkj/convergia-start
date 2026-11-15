import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MensageriaEmMemoria } from '../../../adapters/mensageria/em-memoria.js';
import { construirApp } from '../../../app.js';
import { criarPrisma } from '../../../base/prisma.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../../testes/dependencias.js';
import { enviarEmailDoAlerta } from './email.js';
import { registrarAlerta } from './registrar.js';
import { varrerLembretesEsgotados, varrerPrazos, varrerSemAcao } from './varrer.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const URL_APP = 'https://app.exemplo.com';
const MS_HORA = 60 * 60 * 1000;
const MS_DIA = 24 * MS_HORA;
const apps: FastifyInstance[] = [];
let agenciaId: string;
let adminId: string;
let anaId: string;
let ruiId: string;
let appAdmin: FastifyInstance;
let appAna: FastifyInstance;
let appRui: FastifyInstance;

function construir(usuario: Partial<UsuarioAutenticado>) {
  const app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuarioTeste({ agenciaId, ...usuario })),
    }),
  );
  apps.push(app);
  return app;
}

async function criarOnboarding(tag: string, responsavelId = anaId) {
  const cliente = await prisma.cliente.create({
    data: { agenciaId, nomeEmpresa: `Loja ${tag}`, nomeContato: 'Bia', email: `${tag}@x.com` },
  });
  const o = await prisma.onboarding.create({
    data: {
      agenciaId,
      clienteId: cliente.id,
      responsavelId,
      statusGeral: 'em_andamento',
      etapas: {
        create: (['formulario', 'acessos', 'reuniao', 'captacao'] as const).map((tipo) => ({
          agenciaId,
          tipo,
        })),
      },
    },
  });
  return o.id;
}

const alertas = (onboardingId: string) =>
  prisma.alertaInterno.findMany({ where: { onboardingId }, orderBy: { criadoEm: 'asc' } });

beforeAll(async () => {
  agenciaId = (await prisma.agencia.create({ data: { nome: `Ag ${sufixo}` } })).id;
  await prisma.configAgencia.create({ data: { agenciaId, ...CONFIG_PADRAO } });
  const usuario = (nome: string, papel: 'admin' | 'membro') =>
    prisma.usuario.create({ data: { agenciaId, nome, email: `${nome}-${sufixo}@x.com`, papel } });
  adminId = (await usuario('chefe', 'admin')).id;
  anaId = (await usuario('ana', 'membro')).id;
  ruiId = (await usuario('rui', 'membro')).id;
  appAdmin = construir({ id: adminId });
  appAna = construir({ id: anaId, papel: 'membro' });
  appRui = construir({ id: ruiId, papel: 'membro' });
  await Promise.all(apps.map((a) => a.ready()));
});

afterAll(async () => {
  await Promise.all(apps.map((a) => a.close()));
  await prisma.agencia.deleteMany({ where: { id: agenciaId } });
  await prisma.$disconnect();
});

describe('RN-58 alertas por evento', () => {
  it('concluiu: quando as quatro etapas ficam concluídas, um aviso só', async () => {
    const id = await criarOnboarding('conclui');
    const evento = {
      tipo: 'onboarding.etapas_mudaram' as const,
      agenciaId,
      ocorridoEm: AGORA_TESTE,
      dados: { onboardingId: id, ator: 'cliente' },
    };
    await appAdmin.deps.eventos.publicar(evento);
    expect(await alertas(id)).toHaveLength(0);
    await prisma.etapaOnboarding.updateMany({
      where: { onboardingId: id },
      data: { status: 'concluida' },
    });
    await appAdmin.deps.eventos.publicar(evento);
    await appAdmin.deps.eventos.publicar(evento);
    const lista = await alertas(id);
    expect(lista.map((a) => a.tipo)).toEqual(['concluiu']);
    expect(lista[0]?.email).toBe('pendente');
  });

  it('acesso inválido: sem e-mail se foi o próprio responsável; com e-mail se foi outro', async () => {
    const id = await criarOnboarding('acesso');
    const marcar = (usuarioId: string, minuto: number) =>
      appAdmin.deps.eventos.publicar({
        tipo: 'acesso.marcado_invalido',
        agenciaId,
        ocorridoEm: new Date(AGORA_TESTE.getTime() + minuto * 60_000),
        dados: { onboardingId: id, plataforma: 'instagram', usuarioId },
      });
    await marcar(anaId, 0);
    await marcar(adminId, 1);
    const lista = await alertas(id);
    expect(lista.map((a) => [a.tipo, a.detalhe, a.email])).toEqual([
      ['acesso_invalido', 'instagram', 'dispensado'],
      ['acesso_invalido', 'instagram', 'pendente'],
    ]);
  });

  it('não compareceu, mensagem que falhou e pedido de link novo', async () => {
    const id = await criarOnboarding('eventos');
    await appAdmin.deps.eventos.publicar({
      tipo: 'agendamento.nao_compareceu',
      agenciaId,
      ocorridoEm: AGORA_TESTE,
      dados: { agendamentoId: randomUUID(), onboardingId: id, tipo: 'reuniao', usuarioId: anaId },
    });
    await appAdmin.deps.eventos.publicar({
      tipo: 'notificacao.falhou',
      agenciaId,
      ocorridoEm: AGORA_TESTE,
      dados: { notificacaoId: randomUUID(), onboardingId: id, erro: 'x' },
    });
    await appAdmin.deps.eventos.publicar({
      tipo: 'onboarding.novo_link_solicitado',
      agenciaId,
      ocorridoEm: AGORA_TESTE,
      dados: { onboardingId: id },
    });
    const lista = await alertas(id);
    expect(lista.map((a) => [a.tipo, a.email])).toEqual([
      ['nao_compareceu', 'dispensado'],
      ['mensagem_falhou', 'pendente'],
      ['link_solicitado', 'pendente'],
    ]);
    expect(lista[0]?.detalhe).toBe('reunião');
  });
});

describe('RN-58 alertas por varredura', () => {
  it('link aberto e nenhuma ação em X dias, uma vez por período parado', async () => {
    const id = await criarOnboarding('parado');
    const antes = new Date(AGORA_TESTE.getTime() - 10 * MS_DIA);
    await prisma.primeiroAcesso.create({ data: { agenciaId, onboardingId: id, em: antes } });
    await prisma.onboarding.update({ where: { id }, data: { atualizadoEm: antes } });
    await prisma.etapaOnboarding.updateMany({
      where: { onboardingId: id },
      data: { atualizadoEm: antes },
    });
    const dias = (n: number) => new Date(antes.getTime() + n * MS_DIA);
    await varrerSemAcao(prisma, dias(2.9), agenciaId);
    expect(await alertas(id)).toHaveLength(0);
    await varrerSemAcao(prisma, dias(3), agenciaId);
    await varrerSemAcao(prisma, dias(4), agenciaId);
    expect((await alertas(id)).map((a) => a.tipo)).toEqual(['sem_acao']);
  });

  it('lembretes esgotados: 24h depois do último automático, com etapa pendente', async () => {
    const id = await criarOnboarding('esgotado');
    await prisma.notificacao.create({
      data: {
        agenciaId,
        onboardingId: id,
        tipo: 'lembrete_pendencia',
        categoria: 'lembrete',
        chave: `lembrete_pendencia:${id}:3`,
        corpo: 'x',
        status: 'enviada',
        enviadaEm: AGORA_TESTE,
      },
    });
    await varrerLembretesEsgotados(
      prisma,
      new Date(AGORA_TESTE.getTime() + 23 * MS_HORA),
      agenciaId,
    );
    expect(await alertas(id)).toHaveLength(0);
    await varrerLembretesEsgotados(
      prisma,
      new Date(AGORA_TESTE.getTime() + 24 * MS_HORA),
      agenciaId,
    );
    expect((await alertas(id)).map((a) => a.tipo)).toEqual(['lembretes_esgotados']);
  });

  it('o lembrete 2 de 3 não conta como esgotado', async () => {
    const id = await criarOnboarding('meio');
    await prisma.notificacao.create({
      data: {
        agenciaId,
        onboardingId: id,
        tipo: 'lembrete_pendencia',
        categoria: 'lembrete',
        chave: `lembrete_pendencia:${id}:2`,
        corpo: 'x',
        status: 'enviada',
        enviadaEm: AGORA_TESTE,
      },
    });
    await varrerLembretesEsgotados(prisma, new Date(AGORA_TESTE.getTime() + 2 * MS_DIA), agenciaId);
    expect(await alertas(id)).toHaveLength(0);
  });

  it('prazo atrasado gera aviso, uma vez por data de prazo', async () => {
    const id = await criarOnboarding('prazo');
    await prisma.prazoLiberacao.create({
      data: {
        agenciaId,
        onboardingId: id,
        data: new Date('2026-11-10T00:00:00Z'),
        captacaoData: new Date('2026-11-02T00:00:00Z'),
        diasUteis: 5,
      },
    });
    await varrerPrazos(prisma, AGORA_TESTE, agenciaId);
    await varrerPrazos(prisma, AGORA_TESTE, agenciaId);
    expect((await alertas(id)).map((a) => a.chave)).toEqual([`prazo_atrasado:${id}:2026-11-10`]);
  });
});

describe('e-mail do alerta', () => {
  it('vai ao responsável, com o link do onboarding', async () => {
    const id = await criarOnboarding('email');
    await registrarAlerta(
      prisma,
      { agenciaId, onboardingId: id, tipo: 'concluiu', chave: `t:${id}` },
      AGORA_TESTE,
    );
    const [a] = await alertas(id);
    const m = new MensageriaEmMemoria();
    expect(await enviarEmailDoAlerta(prisma, m, URL_APP, a?.id ?? '', AGORA_TESTE)).toBe('enviado');
    expect(m.enviadas).toHaveLength(1);
    expect(m.enviadas[0]).toMatchObject({ canal: 'email', destinatario: `ana-${sufixo}@x.com` });
    expect(m.enviadas[0]?.corpo).toContain(`${URL_APP}/onboardings/${id}`);
    expect(m.enviadas[0]?.corpo).toContain('Loja email concluiu todas as etapas');
    expect((await alertas(id))[0]?.email).toBe('enviado');
  });

  it('responsável inativo: vai aos Admins', async () => {
    const inativo = await prisma.usuario.create({
      data: { agenciaId, nome: 'ex', email: `ex-${sufixo}@x.com`, papel: 'membro', ativo: false },
    });
    const id = await criarOnboarding('inativo', inativo.id);
    await registrarAlerta(
      prisma,
      { agenciaId, onboardingId: id, tipo: 'concluiu', chave: `t:${id}` },
      AGORA_TESTE,
    );
    const [a] = await alertas(id);
    const m = new MensageriaEmMemoria();
    await enviarEmailDoAlerta(prisma, m, URL_APP, a?.id ?? '', AGORA_TESTE);
    expect(m.enviadas.map((e) => e.destinatario)).toEqual([`chefe-${sufixo}@x.com`]);
  });

  it('falha: tenta de novo e desiste na terceira; o aviso continua no painel', async () => {
    const id = await criarOnboarding('falha');
    await registrarAlerta(
      prisma,
      { agenciaId, onboardingId: id, tipo: 'concluiu', chave: `t:${id}` },
      AGORA_TESTE,
    );
    const [a] = await alertas(id);
    const falha = {
      enviadas: 0,
      enviar() {
        this.enviadas += 1;
        return Promise.resolve({ ok: false as const, erro: 'timeout', temporario: true });
      },
    };
    const em = (min: number) => new Date(AGORA_TESTE.getTime() + min * 60_000);
    expect(await enviarEmailDoAlerta(prisma, falha, URL_APP, a?.id ?? '', em(0))).toBe(
      'aguardando',
    );
    expect(await enviarEmailDoAlerta(prisma, falha, URL_APP, a?.id ?? '', em(1))).toBe(
      'aguardando',
    );
    expect(await enviarEmailDoAlerta(prisma, falha, URL_APP, a?.id ?? '', em(6))).toBe('falhou');
    const [depois] = await alertas(id);
    expect(depois?.email).toBe('falhou');
    expect(depois?.resolvidoEm).toBeNull();
  });
});

describe('página Avisos', () => {
  it('Admin vê todos; membro só os seus; "Resolver" tira para todos', async () => {
    const daAna = await criarOnboarding('lista-ana', anaId);
    const doRui = await criarOnboarding('lista-rui', ruiId);
    for (const id of [daAna, doRui]) {
      await registrarAlerta(
        prisma,
        { agenciaId, onboardingId: id, tipo: 'link_solicitado', chave: `lista:${id}` },
        AGORA_TESTE,
      );
    }
    const ids = async (app: FastifyInstance) =>
      (await app.inject({ method: 'GET', url: '/alertas' }))
        .json<{ avisos: { onboardingId: string; texto: string }[] }>()
        .avisos.map((a) => a.onboardingId);
    expect(await ids(appAdmin)).toEqual(expect.arrayContaining([daAna, doRui]));
    expect(await ids(appRui)).toContain(doRui);
    expect(await ids(appRui)).not.toContain(daAna);

    const contagemAntes = (await appRui.inject({ method: 'GET', url: '/alertas/contagem' })).json<{
      abertos: number;
    }>().abertos;
    const [aviso] = await prisma.alertaInterno.findMany({ where: { onboardingId: doRui } });
    expect(
      (await appAna.inject({ method: 'POST', url: `/alertas/${aviso?.id ?? ''}/resolver` }))
        .statusCode,
    ).toBe(404);
    expect(
      (await appRui.inject({ method: 'POST', url: `/alertas/${aviso?.id ?? ''}/resolver` }))
        .statusCode,
    ).toBe(200);
    expect(await ids(appAdmin)).not.toContain(doRui);
    expect(
      (await appRui.inject({ method: 'GET', url: '/alertas/contagem' })).json<{ abertos: number }>()
        .abertos,
    ).toBe(contagemAntes - 1);
    const resolvidos = (
      await appAdmin.inject({ method: 'GET', url: '/alertas?situacao=resolvidos' })
    ).json<{ avisos: { onboardingId: string }[] }>().avisos;
    expect(resolvidos.map((a) => a.onboardingId)).toContain(doRui);
  });
});
