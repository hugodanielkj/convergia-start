export interface AcessoVisao {
  plataforma: string;
  nome: string;
  obrigatoria: boolean;
  status: 'pendente' | 'concedido' | 'invalido';
  motivo: string | null;
  informado: boolean;
}

export interface EstadoAcessos {
  etapa: 'pendente' | 'em_andamento' | 'concluida';
  plataformas: AcessoVisao[];
}

export const ROTULO_ETAPA: Record<EstadoAcessos['etapa'], string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
};

export function rotuloAcesso(a: AcessoVisao): string {
  if (a.status === 'concedido') return 'Concedido';
  if (a.status === 'invalido') return 'Inválido';
  return a.informado ? 'Cliente avisou que adicionou' : 'Pendente';
}
