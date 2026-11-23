export interface AcessoVisao {
  plataforma: string;
  nome: string;
  obrigatoria: boolean;
  status: 'pendente' | 'concedido' | 'invalido';
  motivo: string | null;
  informado: boolean;
  antes?: string[];
  passos: string[];
  identificador: string | null;
}

export interface EstadoAcessos {
  etapa: 'pendente' | 'em_andamento' | 'concluida';
  plataformas: AcessoVisao[];
}
