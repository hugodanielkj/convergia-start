import type { ReactNode } from 'react';
import estilos from './componentes.module.css';

export type StatusEtapa = 'pendente' | 'em_andamento' | 'concluida' | 'bloqueada';

const ROTULO_STATUS: Record<StatusEtapa, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};

/** Moldura comum das 4 etapas, para a página do cliente ter aparência única. */
export function CartaoEtapa({
  titulo,
  status,
  children,
}: {
  titulo: string;
  status: StatusEtapa;
  children: ReactNode;
}) {
  return (
    <section className={estilos.cartao} aria-label={titulo}>
      <header className={estilos.cabecalho}>
        <h2 className={estilos.titulo}>{titulo}</h2>
        <span className={estilos.status} data-status={status}>
          {ROTULO_STATUS[status]}
        </span>
      </header>
      {children}
    </section>
  );
}
