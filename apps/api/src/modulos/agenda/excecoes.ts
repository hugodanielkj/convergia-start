import { randomUUID } from 'node:crypto';
import type { UsuarioAutenticado } from '@convergia/core/base';
import {
  dataLocal,
  dataValida,
  diaDaSemana,
  janelasSeSobrepoem,
  validarJanela,
  type ErroJanela,
} from '@convergia/core/agenda';
import type { PrismaDaAgencia } from '../../base/escopo-agencia.js';

export type TipoAtendimento = 'reuniao' | 'captacao';

export interface JanelaDoDia {
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracaoMinutos?: number | null | undefined;
}

export interface ExcecaoVisao {
  readonly id: string;
  readonly tipo: TipoAtendimento;
  readonly data: string;
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracaoMinutos: number | null;
}

export type ErroExcecao = ErroJanela | 'data_invalida' | 'data_passada' | 'sobreposicao';

export type ResultadoExcecoes =
  | { readonly tipo: 'invalida'; readonly codigo: ErroExcecao }
  | { readonly tipo: 'salva'; readonly excecoes: ExcecaoVisao[] };

const paraTexto = (data: Date): string => data.toISOString().slice(0, 10);
const paraData = (texto: string): Date => new Date(`${texto}T00:00:00.000Z`);

const VISAO = {
  id: true,
  tipo: true,
  data: true,
  horaInicio: true,
  horaFim: true,
  duracaoMinutos: true,
} as const;

interface Linha {
  id: string;
  tipo: TipoAtendimento;
  data: Date;
  horaInicio: string;
  horaFim: string;
  duracaoMinutos: number | null;
}

const paraVisao = (l: Linha): ExcecaoVisao => ({ ...l, data: paraTexto(l.data) });

/** Exceções do período (datas inclusivas, `YYYY-MM-DD`); sem período, todas de hoje em diante. */
export async function listarExcecoes(
  prisma: PrismaDaAgencia,
  de: string,
  ate?: string,
): Promise<ExcecaoVisao[]> {
  const linhas = await prisma.disponibilidadeDia.findMany({
    where: { data: { gte: paraData(de), ...(ate === undefined ? {} : { lte: paraData(ate) }) } },
    select: VISAO,
    orderBy: [{ data: 'asc' }, { tipo: 'asc' }, { horaInicio: 'asc' }],
  });
  return linhas.map(paraVisao);
}

/**
 * Define o horário de um tipo numa data (RN-30): troca tudo o que havia para o dia. Lista vazia
 * apaga a exceção e o dia volta ao horário padrão. Recusa data passada, janela inválida e janelas
 * que se cruzam. Auditada (RN-77).
 */
export async function definirExcecaoDoDia(
  prisma: PrismaDaAgencia,
  usuario: UsuarioAutenticado,
  fusoAgencia: string,
  agora: Date,
  entrada: { tipo: TipoAtendimento; data: string; janelas: readonly JanelaDoDia[] },
): Promise<ResultadoExcecoes> {
  const { tipo, data, janelas } = entrada;
  if (!dataValida(data)) return { tipo: 'invalida', codigo: 'data_invalida' };
  if (data < dataLocal(agora, fusoAgencia)) return { tipo: 'invalida', codigo: 'data_passada' };

  const dia = diaDaSemana(data);
  const completas = janelas.map((j) => ({
    diaSemana: dia,
    horaInicio: j.horaInicio,
    horaFim: j.horaFim,
    duracaoMinutos: j.duracaoMinutos ?? undefined,
  }));
  for (const janela of completas) {
    const validacao = validarJanela(janela);
    if (!validacao.ok) return { tipo: 'invalida', codigo: validacao.erro };
  }
  for (const [i, a] of completas.entries()) {
    if (completas.slice(i + 1).some((b) => janelasSeSobrepoem(a, b))) {
      return { tipo: 'invalida', codigo: 'sobreposicao' };
    }
  }

  const criadas = await prisma.$transaction([
    prisma.disponibilidadeDia.deleteMany({ where: { tipo, data: paraData(data) } }),
    ...completas.map((j) =>
      prisma.disponibilidadeDia.create({
        data: {
          id: randomUUID(),
          agenciaId: usuario.agenciaId,
          tipo,
          data: paraData(data),
          horaInicio: j.horaInicio,
          horaFim: j.horaFim,
          duracaoMinutos: j.duracaoMinutos ?? null,
        },
        select: VISAO,
      }),
    ),
    prisma.auditoriaLog.create({
      data: {
        agenciaId: usuario.agenciaId,
        ator: `usuario:${usuario.id}`,
        acao: janelas.length === 0 ? 'excecao_dia.removida' : 'excecao_dia.definida',
        entidade: 'DisponibilidadeDia',
        entidadeId: `${tipo}:${data}`,
        dados: { tipo, data, janelas: janelas.length },
      },
    }),
  ]);
  // O primeiro item é o deleteMany e o último, a auditoria; o meio são as linhas criadas.
  return { tipo: 'salva', excecoes: (criadas.slice(1, -1) as Linha[]).map(paraVisao) };
}
