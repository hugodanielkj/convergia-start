'use client';

import type { ReactNode } from 'react';
import estilos from './componentes.module.css';
import { IconePasso } from './IconePasso';
import { usePasso, type EtapaId } from './passo';

export type StatusEtapa = 'pendente' | 'em_andamento' | 'concluida' | 'bloqueada';

const ROTULO_STATUS: Record<StatusEtapa, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  bloqueada: 'Bloqueada',
};

/** Uma frase dizendo o porquê de cada passo (menos dúvida antes de começar). */
const CONTEXTO: Record<EtapaId, string> = {
  formulario: 'Conte um pouco sobre a sua empresa. Salvamos enquanto você escreve.',
  acessos: 'Adicione a agência como parceira nas suas redes. Você não compartilha senhas.',
  reuniao: 'Escolha um horário para a nossa conversa online de alinhamento.',
  captacao: 'Conte onde vamos gravar e escolha o melhor dia.',
};

/**
 * Moldura comum das 4 etapas: ícone, "Passo X de 4", título, uma frase de contexto e o status.
 * O passo vem da casca (ContextoPasso); fora dela, o cartão mostra só título e status.
 */
export function CartaoEtapa({
  titulo,
  status,
  children,
}: {
  titulo: string;
  status: StatusEtapa;
  children: ReactNode;
}) {
  const passo = usePasso();
  return (
    <section className={estilos.cartao} aria-label={titulo}>
      <header className={estilos.cabecalho}>
        {passo && (
          <span className={estilos.iconePasso} data-status={status}>
            <IconePasso etapa={passo.etapa} />
          </span>
        )}
        <div className={estilos.titulos}>
          <p className={estilos.linhaPasso}>
            {passo && (
              <span className={estilos.numeroPasso}>
                Passo {passo.numero} de {passo.total}
              </span>
            )}
            <span className={estilos.status} data-status={status}>
              {ROTULO_STATUS[status]}
            </span>
          </p>
          <h2 className={estilos.titulo}>{titulo}</h2>
        </div>
      </header>
      {/* Concluída, o porquê já não ajuda: fica só o resultado. */}
      {passo && status !== 'concluida' && (
        <p className={estilos.contexto}>{CONTEXTO[passo.etapa]}</p>
      )}
      <div className={estilos.corpo}>{children}</div>
    </section>
  );
}
