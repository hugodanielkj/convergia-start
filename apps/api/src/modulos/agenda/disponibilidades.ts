import { randomUUID } from 'node:crypto';
import {
  NaoEncontradoError,
  RegraVioladaError,
  type UsuarioAutenticado,
} from '@convergia/core/base';
import { janelasSeSobrepoem, validarJanela, type ErroJanela } from '@convergia/core/agenda';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

export type TipoAtendimento = 'reuniao' | 'captacao';

export interface EntradaDisponibilidade {
  readonly tipo: TipoAtendimento;
  readonly diaSemana: number;
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracaoMinutos?: number | undefined;
  /** Profissional a que a janela pertence; sem ele vale para a agência toda (D-02). */
  readonly usuarioId?: string | undefined;
}

export interface DisponibilidadeVisao {
  readonly id: string;
  readonly tipo: TipoAtendimento;
  readonly diaSemana: number;
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracaoMinutos: number | null;
  readonly usuarioId: string | null;
}

export type ResultadoNovaDisponibilidade =
  | { readonly tipo: 'invalida'; readonly codigo: ErroJanela }
  | { readonly tipo: 'criada'; readonly disponibilidade: DisponibilidadeVisao };

const VISAO = {
  id: true,
  tipo: true,
  diaSemana: true,
  horaInicio: true,
  horaFim: true,
  duracaoMinutos: true,
  usuarioId: true,
} as const;

/**
 * Cadastra uma janela semanal de atendimento (RN-30). Recusa janela inválida e janela que se
 * sobrepõe a outra do mesmo tipo, dia e profissional (RN-30). Auditada (RN-77).
 */
export async function criarDisponibilidade(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  entrada: EntradaDisponibilidade,
): Promise<ResultadoNovaDisponibilidade> {
  const validacao = validarJanela(entrada);
  if (!validacao.ok) return { tipo: 'invalida', codigo: validacao.erro };

  const profissionalId = entrada.usuarioId ?? null;
  if (profissionalId !== null) {
    const profissional = await prisma.usuario.findFirst({
      where: { id: profissionalId, ativo: true },
      select: { id: true },
    });
    if (!profissional) throw new NaoEncontradoError('Profissional');
  }

  const doMesmoDia = await prisma.disponibilidade.findMany({
    where: { tipo: entrada.tipo, diaSemana: entrada.diaSemana, usuarioId: profissionalId },
    select: { diaSemana: true, horaInicio: true, horaFim: true },
  });
  if (doMesmoDia.some((existente) => janelasSeSobrepoem(existente, entrada))) {
    throw new RegraVioladaError('RN-30', 'Esta janela se sobrepõe a outra já cadastrada');
  }

  const id = randomUUID();
  const [criada] = await prisma.$transaction([
    prisma.disponibilidade.create({
      data: {
        id,
        agenciaId: usuario.agenciaId,
        usuarioId: profissionalId,
        tipo: entrada.tipo,
        diaSemana: entrada.diaSemana,
        horaInicio: entrada.horaInicio,
        horaFim: entrada.horaFim,
        duracaoMinutos: entrada.duracaoMinutos ?? null,
      },
      select: VISAO,
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'disponibilidade.criada',
        entidade: 'Disponibilidade',
        entidadeId: id,
        dados: { tipo: entrada.tipo, diaSemana: entrada.diaSemana },
      },
    }),
  ]);
  return { tipo: 'criada', disponibilidade: criada };
}

export function listarDisponibilidades(prisma: PrismaDaAgencia): Promise<DisponibilidadeVisao[]> {
  // A ordem do enum no banco (reunião, captação) é a que a tela mostra.
  return prisma.disponibilidade.findMany({
    select: VISAO,
    orderBy: [{ tipo: 'asc' }, { diaSemana: 'asc' }, { horaInicio: 'asc' }],
  });
}

export async function removerDisponibilidade(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  id: string,
): Promise<void> {
  const existente = await prisma.disponibilidade.findUnique({
    where: { id },
    select: { tipo: true, diaSemana: true },
  });
  if (!existente) throw new NaoEncontradoError('Disponibilidade');
  await prisma.$transaction([
    prisma.disponibilidade.deleteMany({ where: { id } }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'disponibilidade.removida',
        entidade: 'Disponibilidade',
        entidadeId: id,
        dados: { tipo: existente.tipo, diaSemana: existente.diaSemana },
      },
    }),
  ]);
}
