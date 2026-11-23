'use client';

import { useActionState } from 'react';
import { salvarBloqueioAction } from './actions';
import type { EstadoBloqueio } from './processar';
import estilos from './agenda.module.css';

const INICIAL: EstadoBloqueio = { tipo: 'inicial' };

/** Fecha um dia inteiro (folga, compromisso): é um bloqueio de um dia só (RN-44). */
export function BloquearDia({ data }: { readonly data: string }) {
  const [estado, salvar, pendente] = useActionState(salvarBloqueioAction, INICIAL);
  return (
    <form action={salvar} className={estilos.editorDia}>
      <h4>Sem atendimento neste dia</h4>
      <input type="hidden" name="dataInicio" value={data} />
      <input type="hidden" name="dataFim" value={data} />
      <div className={estilos.campo}>
        <label htmlFor="motivo-dia">Motivo</label>
        <input id="motivo-dia" name="motivo" required maxLength={200} placeholder="Ex.: folga" />
      </div>
      <div aria-live="polite">
        {estado.tipo === 'erro' && (
          <p role="alert" className={estilos.erro}>
            {estado.mensagem}
          </p>
        )}
        {estado.tipo === 'salvo' && <p role="status">Dia bloqueado.</p>}
      </div>
      <button type="submit" disabled={pendente} className={estilos.botaoSecundario}>
        {pendente ? 'Bloqueando…' : 'Bloquear o dia todo'}
      </button>
    </form>
  );
}
