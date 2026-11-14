'use client';

import { useActionState } from 'react';
import { salvarBloqueioAction } from './actions';
import type { EstadoBloqueio } from './processar';
import estilos from './agenda.module.css';

const INICIAL: EstadoBloqueio = { tipo: 'inicial' };

export function FormularioBloqueio() {
  const [estado, salvar, pendente] = useActionState(salvarBloqueioAction, INICIAL);
  const valores = estado.tipo === 'erro' ? estado.valores : undefined;

  return (
    <form action={salvar} className={estilos.formulario}>
      <h3>Novo bloqueio</h3>
      <div className={estilos.linha}>
        <div className={estilos.campo}>
          <label htmlFor="dataInicio">De</label>
          <input
            id="dataInicio"
            name="dataInicio"
            type="date"
            required
            defaultValue={valores?.dataInicio}
          />
        </div>
        <div className={estilos.campo}>
          <label htmlFor="dataFim">Até (opcional)</label>
          <input id="dataFim" name="dataFim" type="date" defaultValue={valores?.dataFim} />
        </div>
      </div>
      <div className={estilos.campo}>
        <label htmlFor="motivo">Motivo</label>
        <input
          id="motivo"
          name="motivo"
          type="text"
          maxLength={200}
          placeholder="Ex.: recesso, feriado municipal"
          defaultValue={valores?.motivo}
        />
      </div>

      <div aria-live="polite">
        {estado.tipo === 'erro' && (
          <p role="alert" className={estilos.erro}>
            {estado.mensagem}
          </p>
        )}
        {estado.tipo === 'salvo' && <p role="status">Bloqueio salvo.</p>}
      </div>

      <button type="submit" disabled={pendente} className={estilos.botao}>
        {pendente ? 'Salvando…' : 'Adicionar bloqueio'}
      </button>
    </form>
  );
}
