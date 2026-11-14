import { randomUUID } from 'node:crypto';
import { CONFIG_PADRAO, relogioFixo, type UsuarioAutenticado } from '@convergia/core/base';
import { TERMO_ATUAL } from '@convergia/core/consentimento';
import { gerarTokenLink } from '@convergia/core/link';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../../app.js';
import { escopoAgencia } from '../../../base/escopo-agencia.js';
import { criarPrisma } from '../../../base/prisma.js';
import {
  AGORA_TESTE,
  URL_BANCO_TESTE,
  dependenciasDeTeste,
  usuarioTeste,
} from '../../../testes/dependencias.js';
import { avisarEtapasMudaram, concluirVencidos } from './status.js';

const prisma = criarPrisma(URL_BANCO_TESTE);
const sufixo = randomUUID().slice(0, 8);
const DIA = 86_400_000;
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
const statusPublicados: { onboardingId: string; para: string; cancelados: string[] }[] = [];
const agendamentosCanceladosPublicados: string[] = [];

function construir(usuario: UsuarioAutenticado | null): FastifyInstance {
  const app = construirApp(
    { LOG_LEVEL: 'silent' },
    dependenciasDeTeste({
      prisma,
      relogio: relogioFixo(AGORA_TESTE),
      resolverSessao: () => Promise.resolve(usuario),
    }),
  );
  app.deps.eventos.assinar('onboarding.status_alterado', (e) => {
    statusPublicados.push({
      onboardingId: e.dados.onboardingId,
      para: e.dados.para,
      cancelados: e.dados.agendamentosCancelados,
    });
    return Promise.resolve();
  });
  app.deps.eventos.assinar('agendamento.cancelado', (e) => {
    agendamentosCanceladosPublicados.push(e.dados.agendamentoId);
    return Promise.resolve();
  });
  return app;
}

// Cada agendamento ganha um horário próprio: a agência não aceita dois no mesmo intervalo (RN-33).
let horario = 0;
function proximoHorario(deslocamentoDias: number) {
  horario += 1;
  const inicio = new Date(AGORA_TESTE.getTime() + deslocamentoDias * DIA + horario * 3_600_000);
  return { inicio, fim: new Date(inicio.getTime() + 1_800_000) };
}

async function criarOnboarding(tag: string, status: 'criado' | 'em_andamento' = 'criado') {
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
      statusGeral: status,
      etapas: {
        create: (['formulario', 'acessos', 'reuniao', 'captacao'] as const).map((tipo) => ({
          agenciaId,
          tipo,
        })),
      },
      link: {
        create: {
          agenciaId,
          tokenHash: hash,
          expiraEm: new Date(AGORA_TESTE.getTime() + 14 * DIA),
        },
      },
    },
  });
  if (status !== 'criado') {
    await prisma.primeiroAcesso.create({
      data: { agenciaId, onboardingId: onboarding.id, em: AGORA_TESTE },
    });
  }
  return { token, id: onboarding.id };
}

const statusDe = async (id: string) =>
  (await prisma.onboarding.findUniqueOrThrow({ where: { id } })).statusGeral;

const concluirEtapas = (id: string, tipos: ('formulario' | 'acessos')[]) =>
  prisma.etapaOnboarding.updateMany({
    where: { onboardingId: id, tipo: { in: tipos } },
    data: { status: 'concluida' },
  });

const agendar = (
  id: string,
  tipo: 'reuniao' | 'captacao',
  status: 'agendado' | 'realizado' = 'agendado',
  deslocamentoDias = 3,
) =>
  prisma.agendamento.create({
    data: { agenciaId, onboardingId: id, tipo, status, ...proximoHorario(deslocamentoDias) },
  });

const avisar = (id: string) =>
  avisarEtapasMudaram(appAdmin.deps.eventos, agenciaId, id, 'sistema', AGORA_TESTE);

const acao = (app: FastifyInstance, id: string, nome: string, motivo?: string) =>
  app.inject({
    method: 'POST',
    url: `/onboardings/${id}/acoes/${nome}`,
    payload: motivo === undefined ? {} : { motivo },
  });

/** Leva um onboarding até `em_producao` pelos fatos (captação realizada, RN-51). */
async function emProducao(tag: string) {
  const o = await criarOnboarding(tag, 'em_andamento');
  await concluirEtapas(o.id, ['formulario', 'acessos']);
  await agendar(o.id, 'reuniao', 'realizado', -3);
  await agendar(o.id, 'captacao', 'realizado', -2);
  await avisar(o.id);
  return o;
}

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

describe('RN-49 a RN-51 status automático', () => {
  it('RN-50 abrir o link pela primeira vez põe em andamento, com histórico e auditoria', async () => {
    const { token, id } = await criarOnboarding('abre');
    await appPublico.inject({ method: 'POST', url: `/publico/onboardings/${token}/abrir` });
    expect(await statusDe(id)).toBe('em_andamento');
    const transicoes = await prisma.transicaoStatus.findMany({ where: { onboardingId: id } });
    expect(transicoes).toMatchObject([
      { de: 'criado', para: 'em_andamento', ator: `cliente:${id}` },
    ]);
    const log = await prisma.auditoriaLog.findFirst({
      where: { entidadeId: id, acao: 'onboarding.status_alterado' },
    });
    expect(log?.dados).toEqual({ de: 'criado', para: 'em_andamento', motivo: null });
    expect(statusPublicados).toContainEqual({
      onboardingId: id,
      para: 'em_andamento',
      cancelados: [],
    });
  });

  it('segue a jornada conforme etapas e agendamentos, até em produção', async () => {
    const { id } = await criarOnboarding('jornada', 'em_andamento');
    await concluirEtapas(id, ['formulario', 'acessos']);
    await avisar(id);
    expect(await statusDe(id)).toBe('aguardando_agendamentos');

    const reuniao = await agendar(id, 'reuniao');
    const captacao = await agendar(id, 'captacao');
    await avisar(id);
    expect(await statusDe(id)).toBe('aguardando_reuniao');

    await prisma.agendamento.update({ where: { id: reuniao.id }, data: { status: 'realizado' } });
    await avisar(id);
    expect(await statusDe(id)).toBe('aguardando_captacao');

    await prisma.agendamento.update({ where: { id: captacao.id }, data: { status: 'realizado' } });
    await avisar(id);
    expect(await statusDe(id)).toBe('em_producao');

    const caminho = await prisma.transicaoStatus.findMany({
      where: { onboardingId: id },
      orderBy: { em: 'asc' },
    });
    expect(caminho.map((t) => t.para)).toEqual([
      'aguardando_agendamentos',
      'aguardando_reuniao',
      'aguardando_captacao',
      'em_producao',
    ]);
  });

  it('volta a aguardar agendamento quando um agendamento é cancelado', async () => {
    const { id } = await criarOnboarding('volta', 'em_andamento');
    await concluirEtapas(id, ['formulario', 'acessos']);
    await agendar(id, 'reuniao');
    const captacao = await agendar(id, 'captacao');
    await avisar(id);
    expect(await statusDe(id)).toBe('aguardando_reuniao');
    await prisma.agendamento.update({ where: { id: captacao.id }, data: { status: 'cancelado' } });
    await avisar(id);
    expect(await statusDe(id)).toBe('aguardando_agendamentos');
  });

  it('marcar reunião e captação como realizadas pela agenda avança o status (RN-51)', async () => {
    const { id } = await criarOnboarding('agenda-realizado', 'em_andamento');
    await concluirEtapas(id, ['formulario', 'acessos']);
    const reuniao = await agendar(id, 'reuniao', 'agendado', -3);
    const captacao = await agendar(id, 'captacao', 'agendado', -2);
    await avisar(id);
    expect(await statusDe(id)).toBe('aguardando_reuniao');

    const marcar = (agId: string, caminho: string, payload?: object) =>
      appAdmin.inject({
        method: 'POST',
        url: `/agendamentos/${agId}/${caminho}`,
        payload: payload ?? {},
      });
    expect((await marcar(reuniao.id, 'realizado')).statusCode).toBe(200);
    expect(await statusDe(id)).toBe('aguardando_captacao');
    expect((await marcar(captacao.id, 'realizado')).statusCode).toBe(200);
    expect(await statusDe(id)).toBe('em_producao');
  });

  it('cancelar um agendamento pela agenda volta a aguardar agendamento', async () => {
    const { id } = await criarOnboarding('agenda-cancela', 'em_andamento');
    await concluirEtapas(id, ['formulario', 'acessos']);
    await agendar(id, 'reuniao', 'agendado', 4);
    const captacao = await agendar(id, 'captacao', 'agendado', 6);
    await avisar(id);
    expect(await statusDe(id)).toBe('aguardando_reuniao');
    const r = await appAdmin.inject({
      method: 'POST',
      url: `/agendamentos/${captacao.id}/cancelar`,
      payload: { motivo: 'cliente pediu outra data' },
    });
    expect(r.statusCode).toBe(200);
    expect(await statusDe(id)).toBe('aguardando_agendamentos');
  });

  it('a agência marcar o último acesso obrigatório recalcula o status', async () => {
    const { id } = await criarOnboarding('acessos', 'em_andamento');
    await concluirEtapas(id, ['formulario']);
    for (const plataforma of ['instagram', 'facebook']) {
      await appAdmin.inject({
        method: 'PUT',
        url: `/onboardings/${id}/acessos/${plataforma}`,
        payload: { status: 'concedido' },
      });
    }
    expect(await statusDe(id)).toBe('aguardando_agendamentos');
  });

  it('não muda o status de um onboarding pausado', async () => {
    const { id } = await criarOnboarding('pausado-fixo', 'em_andamento');
    expect((await acao(appAdmin, id, 'pausar', 'cliente viajando')).statusCode).toBe(200);
    await concluirEtapas(id, ['formulario', 'acessos']);
    await avisar(id);
    expect(await statusDe(id)).toBe('pausado');
  });
});

describe('RN-52 entrega e encerramento', () => {
  it('o responsável registra a entrega e confirma o encerramento', async () => {
    const { id } = await emProducao('entrega');
    expect(await statusDe(id)).toBe('em_producao');
    const r = await acao(appResponsavel, id, 'registrar_entrega');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ statusGeral: 'primeiro_conteudo_entregue' });
    expect((await acao(appResponsavel, id, 'encerrar')).json()).toEqual({
      statusGeral: 'concluido',
    });
  });

  it('não registra entrega antes da produção nem encerra antes da entrega', async () => {
    const { id } = await criarOnboarding('cedo', 'em_andamento');
    const entrega = await acao(appAdmin, id, 'registrar_entrega');
    expect(entrega.statusCode).toBe(422);
    expect(entrega.json()).toMatchObject({ erro: 'RN-52' });
    expect((await acao(appAdmin, id, 'encerrar')).statusCode).toBe(422);
  });

  it('conclui sozinho N dias após a entrega, como ação do sistema', async () => {
    const { id } = await emProducao('auto');
    await acao(appResponsavel, id, 'registrar_entrega');
    const escopo = (a: string) => escopoAgencia(prisma, a);
    const agencias = [{ agenciaId, dias: CONFIG_PADRAO.diasConclusaoAutomatica }];
    const quaseLa = new Date(
      AGORA_TESTE.getTime() + CONFIG_PADRAO.diasConclusaoAutomatica * DIA - 1,
    );
    await concluirVencidos(escopo, agencias, appAdmin.deps.eventos, quaseLa);
    expect(await statusDe(id)).toBe('primeiro_conteudo_entregue');

    const venceu = new Date(AGORA_TESTE.getTime() + CONFIG_PADRAO.diasConclusaoAutomatica * DIA);
    await concluirVencidos(escopo, agencias, appAdmin.deps.eventos, venceu);
    expect(await statusDe(id)).toBe('concluido');
    const ultima = await prisma.transicaoStatus.findFirst({
      where: { onboardingId: id },
      orderBy: { em: 'desc' },
    });
    expect(ultima).toMatchObject({ para: 'concluido', ator: 'sistema' });
  });
});

describe('RN-53 pausar, retomar e cancelar', () => {
  it('só o Admin pausa, e sempre com motivo', async () => {
    const { id } = await criarOnboarding('pausa', 'em_andamento');
    const membro = await acao(appResponsavel, id, 'pausar', 'quero pausar');
    expect(membro.statusCode).toBe(403);
    expect(membro.json()).toMatchObject({ erro: 'RN-53' });
    const semMotivo = await acao(appAdmin, id, 'pausar', '   ');
    expect(semMotivo.statusCode).toBe(422);
    expect(semMotivo.json()).toMatchObject({ erro: 'RN-53' });

    expect((await acao(appAdmin, id, 'pausar', ' cliente pediu ')).json()).toEqual({
      statusGeral: 'pausado',
    });
    const t = await prisma.transicaoStatus.findFirst({ where: { onboardingId: id } });
    expect(t).toMatchObject({ de: 'em_andamento', para: 'pausado', motivo: 'cliente pediu' });
    expect((await acao(appAdmin, id, 'pausar', 'de novo')).statusCode).toBe(422);
  });

  it('na pausa o cliente continua usando o link; retomar volta ao status das etapas', async () => {
    const { token, id } = await criarOnboarding('retoma', 'em_andamento');
    await acao(appAdmin, id, 'pausar', 'férias');
    const link = await appPublico.inject({ url: `/publico/onboardings/${token}` });
    expect(link.statusCode).toBe(200);
    await concluirEtapas(id, ['formulario', 'acessos']);
    expect((await acao(appAdmin, id, 'retomar')).json()).toEqual({
      statusGeral: 'aguardando_agendamentos',
    });
  });

  it('cancelar invalida o link e cancela só os agendamentos futuros', async () => {
    const { token, id } = await criarOnboarding('cancela', 'em_andamento');
    const passado = await agendar(id, 'reuniao', 'agendado', -2);
    const futuro = await agendar(id, 'captacao', 'agendado', 5);
    const r = await acao(appAdmin, id, 'cancelar', 'cliente desistiu');
    expect(r.json()).toEqual({ statusGeral: 'cancelado' });

    expect((await appPublico.inject({ url: `/publico/onboardings/${token}` })).statusCode).toBe(
      404,
    );
    const status = async (agId: string) =>
      (await prisma.agendamento.findUniqueOrThrow({ where: { id: agId } })).status;
    expect(await status(futuro.id)).toBe('cancelado');
    expect(await status(passado.id)).toBe('agendado');
    // O calendário (RN-67) remove o evento do Google: fica pendente e recebe o evento de cancelamento.
    const cancelado = await prisma.agendamento.findUniqueOrThrow({ where: { id: futuro.id } });
    expect(cancelado).toMatchObject({
      calendarioSituacao: 'pendente',
      calendarioTentativas: 0,
      motivoCancelamento: 'cliente desistiu',
    });
    expect(agendamentosCanceladosPublicados).toContain(futuro.id);
    expect(agendamentosCanceladosPublicados).not.toContain(passado.id);
    expect(statusPublicados).toContainEqual({
      onboardingId: id,
      para: 'cancelado',
      cancelados: [futuro.id],
    });
    const auditado = await prisma.auditoriaLog.count({
      where: { entidadeId: futuro.id, acao: 'agendamento.cancelado' },
    });
    expect(auditado).toBe(1);
    expect((await acao(appAdmin, id, 'cancelar', 'outra vez')).statusCode).toBe(422);
    expect((await acao(appAdmin, id, 'retomar')).statusCode).toBe(422);
  });

  it('duas ações ao mesmo tempo: só uma muda o status', async () => {
    const { id } = await criarOnboarding('corrida', 'em_andamento');
    const respostas = await Promise.all([
      acao(appAdmin, id, 'pausar', 'a'),
      acao(appAdmin, id, 'pausar', 'b'),
    ]);
    expect(respostas.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await prisma.transicaoStatus.count({ where: { onboardingId: id } })).toBe(1);
  });

  it('membro que não é responsável não age, e outra agência não enxerga (RN-02, RN-75)', async () => {
    const { id } = await emProducao('isolado');
    expect((await acao(appOutro, id, 'registrar_entrega')).statusCode).toBe(403);
    expect((await acao(appOutraAgencia, id, 'cancelar', 'x')).statusCode).toBe(404);
    expect(await statusDe(id)).toBe('em_producao');
  });

  it('ação desconhecida é recusada na validação', async () => {
    const { id } = await criarOnboarding('desconhecida');
    expect((await acao(appAdmin, id, 'apagar')).statusCode).toBe(400);
  });
});

describe('RN-54 reabrir o formulário', () => {
  const reabrir = (app: FastifyInstance, id: string, motivo?: string) =>
    app.inject({
      method: 'POST',
      url: `/onboardings/${id}/etapas/formulario/reabrir`,
      payload: motivo === undefined ? {} : { motivo },
    });

  async function formularioEnviado(tag: string) {
    const o = await criarOnboarding(tag, 'em_andamento');
    await concluirEtapas(o.id, ['formulario', 'acessos']);
    await avisar(o.id);
    const versao = await prisma.versaoFormulario.findFirst({ where: { agenciaId } });
    const versaoId =
      versao?.id ??
      (await prisma.versaoFormulario.create({ data: { agenciaId, numero: 1, campos: [] } })).id;
    await prisma.respostaFormulario.create({
      data: {
        agenciaId,
        onboardingId: o.id,
        versaoId,
        respostas: {},
        enviadaEm: AGORA_TESTE,
        fechadaEm: AGORA_TESTE,
      },
    });
    return o;
  }

  it('reabre com motivo: etapa pendente, respostas viram rascunho e o status volta', async () => {
    const { id } = await formularioEnviado('reabre');
    expect(await statusDe(id)).toBe('aguardando_agendamentos');
    const r = await reabrir(appResponsavel, id, ' faltou o CNPJ ');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ statusGeral: 'em_andamento' });

    const etapa = await prisma.etapaOnboarding.findUniqueOrThrow({
      where: { onboardingId_tipo: { onboardingId: id, tipo: 'formulario' } },
    });
    expect(etapa.status).toBe('pendente');
    const resposta = await prisma.respostaFormulario.findUniqueOrThrow({
      where: { onboardingId: id },
    });
    expect(resposta).toMatchObject({ enviadaEm: null, fechadaEm: null, reabertaEm: AGORA_TESTE });
    const log = await prisma.auditoriaLog.findFirst({
      where: { entidadeId: id, acao: 'etapa.reaberta' },
    });
    expect(log?.dados).toEqual({ etapa: 'formulario', motivo: 'faltou o CNPJ' });
  });

  it('reaberto, o cliente edita mesmo depois da reunião', async () => {
    const { token, id } = await formularioEnviado('pos-reuniao');
    await prisma.consentimentoCliente.create({
      data: { agenciaId, onboardingId: id, versaoTermo: TERMO_ATUAL.versao, aceitoEm: AGORA_TESTE },
    });
    await prisma.etapaOnboarding.updateMany({
      where: { onboardingId: id, tipo: 'reuniao' },
      data: { status: 'concluida' },
    });
    await reabrir(appAdmin, id, 'ajustar público-alvo');
    const form = await appPublico.inject({ url: `/publico/onboardings/${token}/formulario` });
    expect(form.json()).toMatchObject({ editavel: true, situacao: 'rascunho' });
  });

  it('recusa sem motivo, etapa não concluída e quem não pode', async () => {
    const { id } = await formularioEnviado('recusa');
    expect((await reabrir(appAdmin, id, ' ')).json()).toMatchObject({ erro: 'RN-54' });
    expect((await reabrir(appOutro, id, 'x')).statusCode).toBe(403);
    expect((await reabrir(appOutraAgencia, id, 'x')).statusCode).toBe(404);
    await reabrir(appAdmin, id, 'primeira');
    const segunda = await reabrir(appAdmin, id, 'segunda');
    expect(segunda.statusCode).toBe(422);
    expect(segunda.json()).toMatchObject({ erro: 'RN-54' });
  });
});
