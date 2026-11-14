'use client';

import { useActionState } from 'react';
import { removerItemAction } from './actions';
import type { EstadoRemocao } from './processar';
import estilos from './agenda.module.css';

const INICIAL: EstadoRemocao = { tipo: 'inicial' };

interface Props {
  readonly id: string;
  readonly alvo: 'janela' | 'bloqueio';
  /** Descrição para leitores de tela, ex.: "Segunda, 09:00 às 12:00". */
  readonly descricao: string;
}

export function BotaoRemover({ id, alvo, descricao }: Props) {
  const [estado, remover, pendente] = useActionState(removerItemAction, INICIAL);

  return (
    <form action={remover} className={estilos.remover}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="alvo" value={alvo} />
      <button
        type="submit"
        disabled={pendente}
        className={estilos.botaoSecundario}
        aria-label={`Remover ${descricao}`}
      >
        {pendente ? 'Removendo…' : 'Remover'}
      </button>
      {estado.tipo === 'erro' && (
        <p role="alert" className={estilos.erro}>
          {estado.mensagem}
        </p>
      )}
    </form>
  );
}
