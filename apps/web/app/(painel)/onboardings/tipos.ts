export interface LinhaPainel {
  id: string;
  cliente: string;
  responsavel: string;
  statusGeral: string;
  progresso: { concluidas: number; total: number };
  etapas: { tipo: string; status: string }[];
  criadoEm: string;
  proximoCompromisso: string | null;
  prazoLiberacao: string | null;
  indicadorPrazo: string | null;
  atencao: string[];
}

export interface RespostaPainel {
  onboardings: LinhaPainel[];
  limitado: boolean;
  responsaveis: { id: string; nome: string }[];
}

export const FILTROS = [
  'status',
  'responsavelId',
  'etapaPendente',
  'de',
  'ate',
  'atencao',
  'prazo',
] as const;
export type Filtros = Partial<Record<(typeof FILTROS)[number], string>>;

export const ROTULO_ATENCAO: Record<string, string> = {
  acesso_invalido: 'Acesso inválido',
  link_expirado: 'Link expirado',
  parado: 'Sem movimento',
};

/** Indicadores do prazo de liberação (RN-48). */
export const ROTULO_PRAZO: Record<string, string> = {
  no_prazo: 'No prazo',
  atencao: 'Atenção',
  atrasado: 'Atrasado',
};

const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** `2026-11-26` vira "26/11/2026". A data do prazo já é do calendário da agência, sem fuso. */
export function formatarDataDoPrazo(data: string): string {
  return DATA_CURTA.format(new Date(`${data}T12:00:00Z`));
}

/** Só repassa à API os filtros conhecidos e preenchidos. */
export function consultaDosFiltros(entrada: Record<string, string | string[] | undefined>): {
  filtros: Filtros;
  consulta: string;
} {
  const filtros: Filtros = {};
  for (const chave of FILTROS) {
    const valor = entrada[chave];
    if (typeof valor === 'string' && valor !== '') filtros[chave] = valor;
  }
  return { filtros, consulta: new URLSearchParams(filtros).toString() };
}
