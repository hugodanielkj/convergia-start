export type EstadoIcone = 'concluida' | 'em_andamento' | 'pendente' | 'bloqueada';

/** Rótulos curtos das etapas, na ordem da página do cliente (RN-79). */
export const ROTULO_ETAPA: Record<string, string> = {
  formulario: 'Formulário',
  acessos: 'Acessos',
  reuniao: 'Reunião',
  captacao: 'Captação',
};

/**
 * Estado visual de uma etapa (S6-4, S6-5): bloqueada pela ordem (RN-79) ganha cadeado; senão vale
 * o status da etapa. `feita` cobre os acessos avisados que ainda esperam a agência confirmar.
 */
export function estadoDaEtapa(etapa: {
  status: string;
  liberada: boolean;
  feita?: boolean;
}): EstadoIcone {
  if (!etapa.liberada) return 'bloqueada';
  if (etapa.status === 'concluida') return 'concluida';
  if (etapa.status === 'em_andamento' || etapa.feita === true) return 'em_andamento';
  return 'pendente';
}
