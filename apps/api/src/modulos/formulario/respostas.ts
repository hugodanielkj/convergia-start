import {
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
  podeVerOnboarding,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { TERMO_ATUAL } from '@convergia/core/consentimento';
import { garantirReabertura, motivoObrigatorio } from '@convergia/core/estados';
import {
  temResposta,
  validarRespostas,
  type CampoFormulario,
  type ErroResposta,
  type Respostas,
} from '@convergia/core/formulario';
import type { Prisma } from '../../generated/prisma/client.js';
import { escopoAgencia, type PrismaDaAgencia } from '../../base/escopo-agencia.js';
import type { PrismaClient } from '../../base/prisma.js';
import { aceiteDoCliente } from '../consentimento/consentimento.js';
import type { LinkLocalizado } from '../link/localizar-link.js';
import { garantirModeloPadrao } from './modelo.js';
import { versaoPresa, versaoVigenteDoCliente, type VersaoEmUso } from './personalizacao.js';

export type SituacaoFormulario = 'rascunho' | 'enviado' | 'fechado';

export interface EstadoFormulario {
  readonly versao: number;
  /** Só os campos ativos: o cliente não vê os arquivados (RN-15). */
  readonly campos: CampoFormulario[];
  readonly respostas: Respostas;
  readonly situacao: SituacaoFormulario;
  /** Falso quando a agência fechou ou a reunião já aconteceu (RN-21). */
  readonly editavel: boolean;
}

export type ResultadoFormulario<T> =
  { readonly tipo: 'sem_consentimento' } | { readonly tipo: 'ok'; readonly valor: T };

export type ResultadoGravacao =
  | { readonly tipo: 'gravado' }
  | { readonly tipo: 'invalido'; readonly erros: readonly ErroResposta[] }
  | { readonly tipo: 'ja_enviado' }
  | { readonly tipo: 'bloqueado'; readonly motivo: 'fechado' | 'reuniao_realizada' };

const lerRespostas = (json: unknown): Respostas => (json ?? {}) as Respostas;
const ator = (onboardingId: string): string => `cliente:${onboardingId}`;

interface SituacaoResposta {
  readonly enviadaEm: Date | null;
  readonly fechadaEm: Date | null;
  readonly reabertaEm: Date | null;
}

/**
 * Edição trancada pela agência ou porque a reunião já ocorreu (RN-21). Reaberto pela agência e ainda
 * não reenviado, o formulário fica livre mesmo depois da reunião (RN-54).
 */
async function motivoBloqueio(
  prisma: PrismaDaAgencia,
  onboardingId: string,
  resposta: SituacaoResposta | null,
): Promise<'fechado' | 'reuniao_realizada' | null> {
  if (resposta?.fechadaEm) return 'fechado';
  if (resposta?.reabertaEm && !resposta.enviadaEm) return null;
  const reuniao = await prisma.etapaOnboarding.findFirst({
    where: { onboardingId, tipo: 'reuniao', status: 'concluida' },
  });
  return reuniao ? 'reuniao_realizada' : null;
}

interface RespostaVinculada {
  readonly versaoId: string;
  readonly versaoClienteId: string | null;
  readonly respostas: unknown;
  readonly enviadaEm: Date | null;
  readonly reabertaEm: Date | null;
}

/**
 * Versão em que o cliente responde (RN-15): a já vinculada, se ele começou a responder; senão a
 * vigente (personalizada pela agência ou padrão), que pode ter mudado desde um rascunho vazio.
 */
async function versaoDoCliente(
  prisma: PrismaDaAgencia,
  onboardingId: string,
  resposta: RespostaVinculada | null,
): Promise<VersaoEmUso> {
  const comecou =
    resposta !== null &&
    (resposta.enviadaEm !== null ||
      resposta.reabertaEm !== null ||
      temResposta(lerRespostas(resposta.respostas)));
  if (resposta && comecou) {
    return versaoPresa(prisma, resposta.versaoId, resposta.versaoClienteId);
  }
  return versaoVigenteDoCliente(prisma, onboardingId);
}

async function comConsentimento<T>(
  prisma: PrismaClient,
  link: LinkLocalizado,
  acao: (escopo: PrismaDaAgencia) => Promise<T>,
): Promise<ResultadoFormulario<T>> {
  if ((await aceiteDoCliente(prisma, link, TERMO_ATUAL.versao)) === null) {
    return { tipo: 'sem_consentimento' };
  }
  const escopo = escopoAgencia(prisma, link.agenciaId);
  await garantirModeloPadrao(escopo, link.agenciaId);
  return { tipo: 'ok', valor: await acao(escopo) };
}

export function lerFormularioDoCliente(prisma: PrismaClient, link: LinkLocalizado) {
  return comConsentimento(prisma, link, async (escopo): Promise<EstadoFormulario> => {
    const resposta = await escopo.respostaFormulario.findFirst({
      where: { onboardingId: link.onboardingId },
    });
    const versao = await versaoDoCliente(escopo, link.onboardingId, resposta);
    const bloqueio = await motivoBloqueio(escopo, link.onboardingId, resposta);
    const situacao: SituacaoFormulario =
      bloqueio === 'fechado' ? 'fechado' : resposta?.enviadaEm ? 'enviado' : 'rascunho';
    return {
      versao: versao.numero,
      campos: versao.campos.filter((c) => !c.arquivado),
      respostas: lerRespostas(resposta?.respostas),
      situacao,
      editavel: bloqueio === null,
    };
  });
}

interface Gravacao {
  readonly resposta: {
    id: string;
    enviadaEm: Date | null;
    fechadaEm: Date | null;
    reabertaEm: Date | null;
    versaoId: string;
    versaoClienteId: string | null;
    respostas: unknown;
  } | null;
  readonly campos: CampoFormulario[];
  readonly versaoId: string;
  readonly versaoClienteId: string | null;
}

async function prepararGravacao(escopo: PrismaDaAgencia, onboardingId: string): Promise<Gravacao> {
  const resposta = await escopo.respostaFormulario.findFirst({ where: { onboardingId } });
  const versao = await versaoDoCliente(escopo, onboardingId, resposta);
  return {
    resposta,
    campos: versao.campos,
    versaoId: versao.versaoId,
    versaoClienteId: versao.versaoClienteId,
  };
}

/** Rascunho automático (RN-18): substitui o rascunho e põe a etapa em andamento. */
export function salvarRascunhoDoCliente(
  prisma: PrismaClient,
  link: LinkLocalizado,
  respostas: Respostas,
) {
  return comConsentimento(prisma, link, async (escopo): Promise<ResultadoGravacao> => {
    const g = await prepararGravacao(escopo, link.onboardingId);
    if (g.resposta?.enviadaEm) return { tipo: 'ja_enviado' };
    const bloqueio = await motivoBloqueio(escopo, link.onboardingId, g.resposta);
    if (bloqueio) return { tipo: 'bloqueado', motivo: bloqueio };

    const erros = validarRespostas(g.campos, respostas, { completo: false });
    if (erros.length > 0) return { tipo: 'invalido', erros };

    await escopo.$transaction([
      escopo.respostaFormulario.upsert({
        where: { onboardingId: link.onboardingId },
        create: {
          agenciaId: link.agenciaId,
          onboardingId: link.onboardingId,
          versaoId: g.versaoId,
          versaoClienteId: g.versaoClienteId,
          respostas: respostas as Prisma.InputJsonValue,
        },
        // Enquanto o rascunho está vazio, a versão acompanha a personalização da agência (RN-15).
        update: {
          respostas: respostas as Prisma.InputJsonValue,
          versaoId: g.versaoId,
          versaoClienteId: g.versaoClienteId,
        },
      }),
      escopo.etapaOnboarding.updateMany({
        where: { onboardingId: link.onboardingId, tipo: 'formulario', status: 'pendente' },
        data: { status: 'em_andamento' },
      }),
    ]);
    return { tipo: 'gravado' };
  });
}

/** Chaves cujo valor mudou, para a auditoria registrar o que foi editado sem guardar o conteúdo. */
function chavesAlteradas(antes: Respostas, depois: Respostas): string[] {
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)]);
  return [...chaves]
    .filter((k) => JSON.stringify(antes[k] ?? null) !== JSON.stringify(depois[k] ?? null))
    .sort();
}

/**
 * Envio final (RN-17) e edições posteriores (RN-21). Exige todos os obrigatórios válidos;
 * conclui a etapa no primeiro envio. Edição depois do envio é auditada (RN-77).
 */
export function enviarFormularioDoCliente(
  prisma: PrismaClient,
  link: LinkLocalizado,
  respostas: Respostas,
  agora: Date,
) {
  return comConsentimento(prisma, link, async (escopo): Promise<ResultadoGravacao> => {
    const g = await prepararGravacao(escopo, link.onboardingId);
    const bloqueio = await motivoBloqueio(escopo, link.onboardingId, g.resposta);
    if (bloqueio) return { tipo: 'bloqueado', motivo: bloqueio };

    const erros = validarRespostas(g.campos, respostas, { completo: true });
    if (erros.length > 0) return { tipo: 'invalido', erros };

    const anteriores = lerRespostas(g.resposta?.respostas);
    const primeiroEnvio = !g.resposta?.enviadaEm;
    const alteradas = chavesAlteradas(anteriores, respostas);
    const auditoria = primeiroEnvio
      ? {
          acao: 'formulario.enviado',
          dados: {
            versao: g.versaoId,
            ...(g.versaoClienteId ? { versaoCliente: g.versaoClienteId } : {}),
          },
        }
      : alteradas.length > 0
        ? { acao: 'formulario.editado', dados: { campos: alteradas.join(',') } }
        : null;

    await escopo.$transaction([
      escopo.respostaFormulario.upsert({
        where: { onboardingId: link.onboardingId },
        create: {
          agenciaId: link.agenciaId,
          onboardingId: link.onboardingId,
          versaoId: g.versaoId,
          versaoClienteId: g.versaoClienteId,
          respostas: respostas as Prisma.InputJsonValue,
          enviadaEm: agora,
        },
        update: {
          respostas: respostas as Prisma.InputJsonValue,
          versaoId: g.versaoId,
          versaoClienteId: g.versaoClienteId,
          ...(primeiroEnvio ? { enviadaEm: agora } : {}),
        },
      }),
      escopo.etapaOnboarding.updateMany({
        where: { onboardingId: link.onboardingId, tipo: 'formulario' },
        data: { status: 'concluida' },
      }),
      ...(auditoria
        ? [
            escopo.auditoriaLog.create({
              data: {
                agenciaId: link.agenciaId,
                ator: ator(link.onboardingId),
                acao: auditoria.acao,
                entidade: 'Onboarding',
                entidadeId: link.onboardingId,
                dados: auditoria.dados,
              },
            }),
          ]
        : []),
    ]);
    return { tipo: 'gravado' };
  });
}

/** A agência fecha o formulário: o cliente não edita mais (RN-21). Só Admin ou responsável (RN-02). */
export async function fecharFormulario(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  agora: Date,
): Promise<void> {
  const onboarding = await prisma.onboarding.findFirst({
    where: { id: onboardingId },
    select: { responsavelId: true },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeVerOnboarding(usuario, onboarding.responsavelId)) throw new ProibidoError('RN-02');

  const resposta = await prisma.respostaFormulario.findFirst({ where: { onboardingId } });
  if (!resposta?.enviadaEm) {
    throw new RegraVioladaError('RN-21', 'O cliente ainda não enviou o formulário');
  }
  if (resposta.fechadaEm) return;
  await prisma.$transaction([
    prisma.respostaFormulario.update({ where: { onboardingId }, data: { fechadaEm: agora } }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'formulario.fechado',
        entidade: 'Onboarding',
        entidadeId: onboardingId,
      },
    }),
  ]);
}

/**
 * A agência reabre o formulário concluído, com motivo (RN-54): a etapa volta a pendente, as respostas
 * viram rascunho e o cliente pode editar e reenviar, mesmo depois da reunião. Só Admin ou responsável.
 */
export async function reabrirFormulario(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  motivoInformado: string,
  agora: Date,
): Promise<void> {
  const onboarding = await prisma.onboarding.findFirst({
    where: { id: onboardingId },
    select: {
      responsavelId: true,
      statusGeral: true,
      etapas: { where: { tipo: 'formulario' }, select: { status: true } },
    },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeVerOnboarding(usuario, onboarding.responsavelId)) throw new ProibidoError('RN-02');
  const motivo = motivoObrigatorio('RN-54', motivoInformado);
  garantirReabertura(
    'formulario',
    onboarding.etapas[0]?.status ?? 'pendente',
    onboarding.statusGeral,
  );

  await prisma.$transaction([
    prisma.respostaFormulario.updateMany({
      where: { onboardingId },
      data: { enviadaEm: null, fechadaEm: null, reabertaEm: agora },
    }),
    prisma.etapaOnboarding.updateMany({
      where: { onboardingId, tipo: 'formulario', status: 'concluida' },
      data: { status: 'pendente' },
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'etapa.reaberta',
        entidade: 'Onboarding',
        entidadeId: onboardingId,
        dados: { etapa: 'formulario', motivo },
        em: agora,
      },
    }),
  ]);
}
