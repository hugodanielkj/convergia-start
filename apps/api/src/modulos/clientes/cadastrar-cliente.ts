import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '@convergia/core/base';
import {
  encontrarDuplicidades,
  validarCadastroCliente,
  type DadosCadastroCliente,
  type Duplicidade,
  type ErroCadastro,
} from '@convergia/core/clientes';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';
import { prepararLink, type LinkEmitido } from '../link/emitir-link.js';
import {
  dadosNovoOnboarding,
  resolverResponsavel,
  resumirOnboarding,
  type OnboardingResumo,
} from '../onboarding/criar-onboarding.js';

export interface EntradaCadastro extends DadosCadastroCliente {
  /** O usuário viu o alerta de duplicidade (RN-07) e quer cadastrar mesmo assim. */
  readonly confirmarDuplicidade: boolean;
  /** Só o Admin pode escolher; sem escolha, o responsável é o Admin da agência (RN-08). */
  readonly responsavelId?: string | undefined;
}

export interface ClienteCadastrado {
  readonly id: string;
  readonly nomeEmpresa: string;
  readonly nomeContato: string;
  readonly whatsapp: string | null;
  readonly email: string | null;
  readonly criadoEm: Date;
  /** Onboarding mais recente do cliente. */
  readonly onboarding: OnboardingResumo | null;
}

export type ResultadoCadastroCliente =
  | { readonly tipo: 'invalido'; readonly erros: readonly ErroCadastro[] }
  | { readonly tipo: 'duplicado'; readonly duplicidades: readonly Duplicidade[] }
  | {
      readonly tipo: 'criado';
      readonly cliente: ClienteCadastrado;
      /** Único momento em que o token aparece: depois só existe o hash (D-13). */
      readonly link: LinkEmitido;
    };

const COM_ONBOARDING = {
  onboardings: {
    orderBy: { criadoEm: 'desc' },
    take: 1,
    // Ordem do enum no banco = ordem da jornada do cliente (RN-06).
    include: { etapas: { orderBy: { tipo: 'asc' } } },
  },
} as const;

/**
 * Cadastra um cliente (RN-04, RN-05), alertando antes se já existir o mesmo e-mail ou WhatsApp
 * na agência (RN-07). Cria junto o onboarding com as quatro etapas pendentes (RN-06), com o
 * responsável da RN-08. O banco já vem restrito à agência (RN-75). Cliente, onboarding e
 * auditoria (RN-77) gravam na mesma transação; a auditoria não guarda dados de contato.
 */
export async function cadastrarCliente(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  entrada: EntradaCadastro,
  agora: Date,
): Promise<ResultadoCadastroCliente> {
  const validacao = validarCadastroCliente(entrada);
  if (!validacao.ok) return { tipo: 'invalido', erros: validacao.erros };

  const { cliente } = validacao;
  const duplicidades = await buscarDuplicidades(prisma, cliente);
  if (duplicidades.length > 0 && !entrada.confirmarDuplicidade) {
    return { tipo: 'duplicado', duplicidades };
  }

  const responsavelId = await resolverResponsavel(prisma, usuario, entrada.responsavelId);
  const id = randomUUID();
  const link = await prepararLink(prisma, usuario.agenciaId, agora);
  const onboarding = dadosNovoOnboarding(usuario.agenciaId, responsavelId, link.dados);
  const ator = `usuario:${usuario.id}`;
  const [criado] = await prisma.$transaction([
    prisma.cliente.create({
      data: { id, agenciaId: usuario.agenciaId, ...cliente, onboardings: { create: onboarding } },
      include: COM_ONBOARDING,
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator,
        acao: 'cliente.criado',
        entidade: 'Cliente',
        entidadeId: id,
        dados: { duplicidadeConfirmada: duplicidades.length > 0 },
      },
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator,
        acao: 'onboarding.criado',
        entidade: 'Onboarding',
        entidadeId: onboarding.id,
        dados: { clienteId: id, responsavelId },
      },
    }),
  ]);
  return { tipo: 'criado', cliente: paraResposta(criado), link: link.emitido };
}

export async function listarClientes(prisma: PrismaDaAgencia): Promise<ClienteCadastrado[]> {
  const clientes = await prisma.cliente.findMany({
    orderBy: { criadoEm: 'desc' },
    include: COM_ONBOARDING,
  });
  return clientes.map(paraResposta);
}

async function buscarDuplicidades(
  prisma: PrismaDaAgencia,
  canais: { whatsapp: string | null; email: string | null },
): Promise<readonly Duplicidade[]> {
  const condicoes = [
    ...(canais.whatsapp === null ? [] : [{ whatsapp: canais.whatsapp }]),
    ...(canais.email === null ? [] : [{ email: canais.email }]),
  ];
  if (condicoes.length === 0) return [];

  const candidatos = await prisma.cliente.findMany({
    where: { OR: condicoes },
    select: { id: true, nomeEmpresa: true, whatsapp: true, email: true },
  });
  return encontrarDuplicidades(canais, candidatos);
}

function paraResposta(
  cliente: Omit<ClienteCadastrado, 'onboarding'> & { onboardings: OnboardingResumo[] },
): ClienteCadastrado {
  const { id, nomeEmpresa, nomeContato, whatsapp, email, criadoEm, onboardings } = cliente;
  const [ultimo] = onboardings;
  return {
    id,
    nomeEmpresa,
    nomeContato,
    whatsapp,
    email,
    criadoEm,
    onboarding: ultimo ? resumirOnboarding(ultimo) : null,
  };
}
