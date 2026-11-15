import { randomUUID } from 'node:crypto';
import {
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
  podeAlterarConfiguracoes,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import {
  criarEtapasIniciais,
  onboardingAtivo,
  STATUS_ONBOARDING,
  type StatusEtapa,
  type StatusOnboarding,
  type TipoEtapa,
} from '@convergia/core/onboarding';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { prepararLink, type DadosLink, type LinkEmitido } from '../link/emitir-link.js';

export interface OnboardingResumo {
  readonly id: string;
  readonly responsavelId: string;
  readonly statusGeral: StatusOnboarding;
  readonly etapas: readonly { readonly tipo: TipoEtapa; readonly status: StatusEtapa }[];
  readonly criadoEm: Date;
}

const STATUS_ATIVOS = STATUS_ONBOARDING.filter(onboardingAtivo);

/**
 * Responsável do onboarding (RN-08). Só o Admin escolhe outra pessoa; sem escolha, vale o
 * Admin mais antigo da agência.
 */
export async function resolverResponsavel(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  responsavelId: string | undefined,
): Promise<string> {
  if (responsavelId !== undefined) {
    if (!podeAlterarConfiguracoes(usuario)) throw new ProibidoError('RN-08');
    const escolhido = await prisma.usuario.findFirst({
      where: { id: responsavelId, ativo: true },
      select: { id: true },
    });
    if (!escolhido) throw new NaoEncontradoError('Responsável');
    return escolhido.id;
  }

  const admin = await prisma.usuario.findFirst({
    where: { papel: 'admin', ativo: true },
    orderBy: { criadoEm: 'asc' },
    select: { id: true },
  });
  if (!admin) throw new RegraVioladaError('RN-08', 'A agência não tem administrador ativo');
  return admin.id;
}

/** Dados de um onboarding novo com as quatro etapas pendentes (RN-06), prontos para o Prisma. */
export function dadosNovoOnboarding(agenciaId: string, responsavelId: string, link: DadosLink) {
  return {
    id: randomUUID(),
    agenciaId,
    responsavelId,
    link: { create: link },
    etapas: {
      create: criarEtapasIniciais().map((etapa) => ({ agenciaId, ...etapa })),
    },
  };
}

/**
 * Cria um novo onboarding para um cliente que já existe, por exemplo depois de um anterior
 * concluído ou cancelado. Recusa se já houver um ativo (RN-07).
 */
export async function criarOnboardingParaCliente(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  clienteId: string,
  responsavelId: string | undefined,
  agora: Date,
  chaveLink: Uint8Array | null,
): Promise<{ onboarding: OnboardingResumo; link: LinkEmitido }> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true },
  });
  if (!cliente) throw new NaoEncontradoError('Cliente');

  const ativo = await prisma.onboarding.findFirst({
    where: { clienteId, statusGeral: { in: STATUS_ATIVOS } },
    select: { id: true },
  });
  if (ativo) throw segundoOnboardingAtivo();

  const responsavel = await resolverResponsavel(prisma, usuario, responsavelId);
  const link = await prepararLink(prisma, usuario.agenciaId, agora, chaveLink);
  const dados = dadosNovoOnboarding(usuario.agenciaId, responsavel, link.dados);
  try {
    const [criado] = await prisma.$transaction([
      prisma.onboarding.create({
        data: { ...dados, clienteId },
        include: { etapas: { orderBy: { tipo: 'asc' } } },
      }),
      prisma.auditoriaLog.create({
        data: {
          agenciaId: usuario.agenciaId,
          ator: `usuario:${usuario.id}`,
          acao: 'onboarding.criado',
          entidade: 'Onboarding',
          entidadeId: dados.id,
          dados: { clienteId, responsavelId: responsavel },
        },
      }),
    ]);
    return { onboarding: resumirOnboarding(criado), link: link.emitido };
  } catch (erro) {
    // Duas requisições ao mesmo tempo passam na checagem acima; o índice único parcial barra a segunda.
    if (violouUnicidade(erro)) throw segundoOnboardingAtivo();
    throw erro;
  }
}

function segundoOnboardingAtivo(): RegraVioladaError {
  return new RegraVioladaError('RN-07', 'Este cliente já tem um onboarding ativo');
}

function violouUnicidade(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 'P2002';
}

/** Só o que a tela precisa: sem `agenciaId` nem ids internos das etapas. */
export function resumirOnboarding(onboarding: OnboardingResumo): OnboardingResumo {
  const { id, responsavelId, statusGeral, etapas, criadoEm } = onboarding;
  return {
    id,
    responsavelId,
    statusGeral,
    etapas: etapas.map(({ tipo, status }) => ({ tipo, status })),
    criadoEm,
  };
}
