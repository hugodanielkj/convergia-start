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
] as const;
export type Filtros = Partial<Record<(typeof FILTROS)[number], string>>;

export const ROTULO_ATENCAO: Record<string, string> = {
  acesso_invalido: 'Acesso inválido',
  link_expirado: 'Link expirado',
  parado: 'Sem movimento',
};

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
