import {
  NaoEncontradoError,
  ProibidoError,
  podeVerOnboarding,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import {
  camposDaPersonalizacao,
  personalizacaoTravada,
  validarPersonalizacao,
  type CampoFormulario,
  type ErroModelo,
  type Respostas,
} from '@convergia/core/formulario';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { completarCampos, garantirModeloPadrao, lerCampos, type CampoDeEntrada } from './modelo.js';

export interface EstadoPersonalizacao {
  /** Falso: o cliente usa o modelo padrão da agência. */
  readonly personalizada: boolean;
  /** Número da versão do cliente (1, 2...), ou null se não personalizada. */
  readonly versao: number | null;
  /** Versão do modelo padrão de onde a personalização partiu (ou a vigente). */
  readonly versaoPadrao: number;
  readonly campos: CampoFormulario[];
  /** RN-15: o cliente já começou a responder; não dá mais para editar. */
  readonly travada: boolean;
}

export type ResultadoPersonalizacao =
  | { readonly tipo: 'salva'; readonly estado: EstadoPersonalizacao }
  | { readonly tipo: 'sem_alteracoes'; readonly estado: EstadoPersonalizacao }
  | { readonly tipo: 'invalida'; readonly erros: readonly ErroModelo[] }
  | { readonly tipo: 'travada' };

/** Versão em que um cliente responde (RN-15): a personalizada mais recente, ou a padrão vigente. */
export interface VersaoEmUso {
  readonly versaoId: string;
  readonly versaoClienteId: string | null;
  readonly numero: number;
  readonly campos: CampoFormulario[];
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

async function ultimaPersonalizada(prisma: PrismaDaAgencia, onboardingId: string) {
  return prisma.versaoFormularioCliente.findFirst({
    where: { onboardingId },
    orderBy: { numero: 'desc' },
  });
}

/**
 * Versão que vale para o cliente agora, quando ele ainda não começou a responder (RN-15): a última
 * personalização do onboarding ou, sem ela, a versão padrão mais recente da agência.
 */
export async function versaoVigenteDoCliente(
  prisma: PrismaDaAgencia,
  onboardingId: string,
): Promise<VersaoEmUso> {
  const personalizada = await ultimaPersonalizada(prisma, onboardingId);
  if (personalizada) {
    return {
      versaoId: personalizada.baseId,
      versaoClienteId: personalizada.id,
      numero: personalizada.numero,
      campos: lerCampos(personalizada.campos),
    };
  }
  const padrao = await prisma.versaoFormulario.findFirstOrThrow({ orderBy: { numero: 'desc' } });
  return {
    versaoId: padrao.id,
    versaoClienteId: null,
    numero: padrao.numero,
    campos: lerCampos(padrao.campos),
  };
}

/** Versão já presa a uma resposta (RN-15): a personalizada, se houver, senão a padrão. */
export async function versaoPresa(
  prisma: PrismaDaAgencia,
  versaoId: string,
  versaoClienteId: string | null,
): Promise<VersaoEmUso> {
  if (versaoClienteId) {
    const v = await prisma.versaoFormularioCliente.findFirstOrThrow({
      where: { id: versaoClienteId },
    });
    return { versaoId, versaoClienteId, numero: v.numero, campos: lerCampos(v.campos) };
  }
  const v = await prisma.versaoFormulario.findFirstOrThrow({ where: { id: versaoId } });
  return { versaoId, versaoClienteId: null, numero: v.numero, campos: lerCampos(v.campos) };
}

async function exigirOnboarding(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
): Promise<void> {
  const onboarding = await prisma.onboarding.findFirst({
    where: { id: onboardingId },
    select: { responsavelId: true },
  });
  if (!onboarding) throw new NaoEncontradoError('Onboarding');
  if (!podeVerOnboarding(usuario, onboarding.responsavelId)) throw new ProibidoError('RN-02');
}

async function estaTravada(prisma: PrismaDaAgencia, onboardingId: string): Promise<boolean> {
  const resposta = await prisma.respostaFormulario.findFirst({
    where: { onboardingId },
    select: { respostas: true, enviadaEm: true, reabertaEm: true },
  });
  return personalizacaoTravada(
    resposta && { ...resposta, respostas: (resposta.respostas ?? {}) as Respostas },
  );
}

async function montarEstado(
  prisma: PrismaDaAgencia,
  onboardingId: string,
): Promise<EstadoPersonalizacao> {
  const [personalizada, travada] = await Promise.all([
    ultimaPersonalizada(prisma, onboardingId),
    estaTravada(prisma, onboardingId),
  ]);
  if (personalizada) {
    const base = await prisma.versaoFormulario.findFirstOrThrow({
      where: { id: personalizada.baseId },
      select: { numero: true },
    });
    return {
      personalizada: true,
      versao: personalizada.numero,
      versaoPadrao: base.numero,
      campos: lerCampos(personalizada.campos),
      travada,
    };
  }
  const padrao = await prisma.versaoFormulario.findFirstOrThrow({ orderBy: { numero: 'desc' } });
  return {
    personalizada: false,
    versao: null,
    versaoPadrao: padrao.numero,
    campos: camposDaPersonalizacao(lerCampos(padrao.campos)),
    travada,
  };
}

/** Perguntas que o cliente vai responder, para a agência personalizar (RN-15, RN-02). */
export async function lerPersonalizacao(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
): Promise<EstadoPersonalizacao> {
  await exigirOnboarding(prisma, usuario, onboardingId);
  await garantirModeloPadrao(prisma, usuario.agenciaId);
  return montarEstado(prisma, onboardingId);
}

/** Campos ativos do modelo padrão vigente: ponto de partida da seção do cadastro (RN-15). */
export async function lerCamposPadrao(
  prisma: PrismaDaAgencia,
  agenciaId: string,
): Promise<{ versaoPadrao: number; campos: CampoFormulario[] }> {
  await garantirModeloPadrao(prisma, agenciaId);
  const padrao = await prisma.versaoFormulario.findFirstOrThrow({ orderBy: { numero: 'desc' } });
  return { versaoPadrao: padrao.numero, campos: camposDaPersonalizacao(lerCampos(padrao.campos)) };
}

/**
 * Salva as perguntas só deste cliente (RN-15): cada gravação cria uma versão nova e imutável do
 * cliente, sem mexer no modelo padrão. Recusa depois que o cliente começou a responder. Auditado.
 */
export async function salvarPersonalizacao(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  onboardingId: string,
  entrada: readonly CampoDeEntrada[],
): Promise<ResultadoPersonalizacao> {
  await exigirOnboarding(prisma, usuario, onboardingId);
  await garantirModeloPadrao(prisma, usuario.agenciaId);
  const atual = await montarEstado(prisma, onboardingId);
  if (atual.travada) return { tipo: 'travada' };

  const campos = completarCampos(entrada);
  const erros = validarPersonalizacao(campos);
  if (erros.length > 0) return { tipo: 'invalida', erros };
  if (igual(campos, atual.campos)) return { tipo: 'sem_alteracoes', estado: atual };

  const anterior = await ultimaPersonalizada(prisma, onboardingId);
  const baseId =
    anterior?.baseId ??
    (await prisma.versaoFormulario.findFirstOrThrow({ orderBy: { numero: 'desc' } })).id;
  const numero = (anterior?.numero ?? 0) + 1;
  await prisma.$transaction([
    prisma.versaoFormularioCliente.create({
      data: {
        agenciaId: usuario.agenciaId,
        onboardingId,
        numero,
        campos: campos as unknown as Prisma.InputJsonValue,
        baseId,
        criadaPor: usuario.id,
      },
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'formulario.personalizado',
        entidade: 'Onboarding',
        entidadeId: onboardingId,
        dados: { versao: numero, perguntas: campos.length },
      },
    }),
  ]);
  return { tipo: 'salva', estado: await montarEstado(prisma, onboardingId) };
}
