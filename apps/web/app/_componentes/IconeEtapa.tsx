import type { EstadoIcone } from './estado-etapa';
import estilos from './icone-etapa.module.css';

export type { EstadoIcone } from './estado-etapa';

const DESCRICAO: Record<EstadoIcone, string> = {
  concluida: 'concluída',
  em_andamento: 'em andamento',
  pendente: 'pendente',
  bloqueada: 'bloqueada',
};

export const descreverEtapa = (rotulo: string, estado: EstadoIcone): string =>
  `${rotulo}: ${DESCRICAO[estado]}`;

/**
 * Ícone de uma etapa (S6-4, S6-5): verde com ✓ = concluída, laranja = em andamento, cinza =
 * pendente, cadeado = bloqueada. O estado vai no nome acessível e no tooltip, não só na cor.
 */
export function IconeEtapa({
  estado,
  numero,
  rotulo,
  decorativo = false,
}: {
  estado: EstadoIcone;
  numero: number;
  rotulo: string;
  /** Verdadeiro quando o texto ao lado já diz a etapa (o estado vai no title). */
  decorativo?: boolean;
}) {
  const descricao = descreverEtapa(rotulo, estado);
  return (
    <span
      className={estilos.icone}
      data-estado={estado}
      title={descricao}
      role={decorativo ? undefined : 'img'}
      aria-label={decorativo ? undefined : descricao}
      aria-hidden={decorativo ? true : undefined}
    >
      {estado === 'concluida' ? (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      ) : estado === 'bloqueada' ? (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="currentColor" />
          <path
            d="M5.5 7V5a2.5 2.5 0 015 0v2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      ) : (
        <span aria-hidden="true">{numero}</span>
      )}
    </span>
  );
}
