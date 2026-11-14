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

export interface EntradaCadastro extends DadosCadastroCliente {
  /** O usuário viu o alerta de duplicidade (RN-07) e quer cadastrar mesmo assim. */
  readonly confirmarDuplicidade: boolean;
}

export interface ClienteCadastrado {
  readonly id: string;
  readonly nomeEmpresa: string;
  readonly nomeContato: string;
  readonly whatsapp: string | null;
  readonly email: string | null;
  readonly criadoEm: Date;
}

export type ResultadoCadastroCliente =
  | { readonly tipo: 'invalido'; readonly erros: readonly ErroCadastro[] }
  | { readonly tipo: 'duplicado'; readonly duplicidades: readonly Duplicidade[] }
  | { readonly tipo: 'criado'; readonly cliente: ClienteCadastrado };

/**
 * Cadastra um cliente (RN-04, RN-05), alertando antes se já existir o mesmo e-mail ou WhatsApp
 * na agência (RN-07). O banco já vem restrito à agência (RN-75). A criação e o registro de
 * auditoria (RN-77) gravam juntos; a auditoria não guarda dados de contato.
 */
export async function cadastrarCliente(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  entrada: EntradaCadastro,
): Promise<ResultadoCadastroCliente> {
  const validacao = validarCadastroCliente(entrada);
  if (!validacao.ok) return { tipo: 'invalido', erros: validacao.erros };

  const { cliente } = validacao;
  const duplicidades = await buscarDuplicidades(prisma, cliente);
  if (duplicidades.length > 0 && !entrada.confirmarDuplicidade) {
    return { tipo: 'duplicado', duplicidades };
  }

  const id = randomUUID();
  const [criado] = await prisma.$transaction([
    prisma.cliente.create({ data: { id, agenciaId: usuario.agenciaId, ...cliente } }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'cliente.criado',
        entidade: 'Cliente',
        entidadeId: id,
        dados: { duplicidadeConfirmada: duplicidades.length > 0 },
      },
    }),
  ]);
  return { tipo: 'criado', cliente: paraResposta(criado) };
}

export async function listarClientes(prisma: PrismaDaAgencia): Promise<ClienteCadastrado[]> {
  const clientes = await prisma.cliente.findMany({ orderBy: { criadoEm: 'desc' } });
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

function paraResposta(cliente: ClienteCadastrado): ClienteCadastrado {
  const { id, nomeEmpresa, nomeContato, whatsapp, email, criadoEm } = cliente;
  return { id, nomeEmpresa, nomeContato, whatsapp, email, criadoEm };
}
