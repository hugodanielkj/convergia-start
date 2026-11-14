import { randomUUID } from 'node:crypto';
import { NaoEncontradoError, type UsuarioAutenticado } from '@convergia/core/base';
import { validarBloqueio, type Bloqueio, type ErroBloqueio } from '@convergia/core/agenda';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

export interface BloqueioVisao extends Bloqueio {
  readonly id: string;
}

export type ResultadoNovoBloqueio =
  | { readonly tipo: 'invalido'; readonly codigo: ErroBloqueio }
  | { readonly tipo: 'criado'; readonly bloqueio: BloqueioVisao };

// O banco guarda `date`; a API fala em "YYYY-MM-DD", o mesmo formato do core (sem fuso).
const paraTexto = (data: Date): string => data.toISOString().slice(0, 10);
const paraData = (texto: string): Date => new Date(`${texto}T00:00:00.000Z`);

interface LinhaBloqueio {
  id: string;
  dataInicio: Date;
  dataFim: Date;
  motivo: string;
}

const paraVisao = (b: LinhaBloqueio): BloqueioVisao => ({
  id: b.id,
  dataInicio: paraTexto(b.dataInicio),
  dataFim: paraTexto(b.dataFim),
  motivo: b.motivo,
});

/**
 * Cadastra um bloqueio de período (RN-44): folga, recesso, feriado estadual ou municipal.
 * A auditoria (RN-77) guarda só o período, não o motivo, que é texto livre.
 */
export async function criarBloqueio(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  entrada: Bloqueio,
): Promise<ResultadoNovoBloqueio> {
  const validacao = validarBloqueio(entrada);
  if (!validacao.ok) return { tipo: 'invalido', codigo: validacao.erro };

  const { dataInicio, dataFim, motivo } = validacao.bloqueio;
  const id = randomUUID();
  const [criado] = await prisma.$transaction([
    prisma.bloqueio.create({
      data: {
        id,
        agenciaId: usuario.agenciaId,
        dataInicio: paraData(dataInicio),
        dataFim: paraData(dataFim),
        motivo,
      },
    }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'bloqueio.criado',
        entidade: 'Bloqueio',
        entidadeId: id,
        dados: { dataInicio, dataFim },
      },
    }),
  ]);
  return { tipo: 'criado', bloqueio: paraVisao(criado) };
}

export async function listarBloqueios(prisma: PrismaDaAgencia): Promise<BloqueioVisao[]> {
  const bloqueios = await prisma.bloqueio.findMany({
    orderBy: [{ dataInicio: 'asc' }, { dataFim: 'asc' }],
  });
  return bloqueios.map(paraVisao);
}

export async function removerBloqueio(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  id: string,
): Promise<void> {
  const existente = await prisma.bloqueio.findUnique({
    where: { id },
    select: { dataInicio: true, dataFim: true },
  });
  if (!existente) throw new NaoEncontradoError('Bloqueio');
  await prisma.$transaction([
    prisma.bloqueio.deleteMany({ where: { id } }),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: 'bloqueio.removido',
        entidade: 'Bloqueio',
        entidadeId: id,
        dados: {
          dataInicio: paraTexto(existente.dataInicio),
          dataFim: paraTexto(existente.dataFim),
        },
      },
    }),
  ]);
}
