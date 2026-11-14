'use client';

import { useActionState } from 'react';
import { salvarJanelaAction } from './actions';
import { ORDEM_DA_SEMANA, rotuloDia } from './mensagens';
import type { EstadoJanela } from './processar';
import estilos from './agenda.module.css';

const INICIAL: EstadoJanela = { tipo: 'inicial' };
const SEGUNDA_A_SEXTA = ['1', '2', '3', '4', '5'];

export function FormularioJanela() {
  const [estado, salvar, pendente] = useActionState(salvarJanelaAction, INICIAL);
  const valores = estado.tipo === 'erro' ? estado.valores : undefined;
  const diasMarcados = valores?.dias ?? SEGUNDA_A_SEXTA;

  return (
    <form action={salvar} className={estilos.formulario}>
      <h3>Nova janela de atendimento</h3>

      <div className={estilos.campo}>
        <label htmlFor="tipo">Tipo</label>
        <select id="tipo" name="tipo" defaultValue={valores?.tipo ?? 'reuniao'}>
          <option value="reuniao">Reunião (online)</option>
          <option value="captacao">Captação (presencial)</option>
        </select>
      </div>

      <fieldset className={estilos.dias}>
        <legend>Dias da semana</legend>
        {ORDEM_DA_SEMANA.map((dia) => (
          <label key={dia} className={estilos.dia}>
            <input
              type="checkbox"
              name="diaSemana"
              value={dia}
              defaultChecked={diasMarcados.includes(String(dia))}
            />
            {rotuloDia(dia)}
          </label>
        ))}
      </fieldset>

      <div className={estilos.linha}>
        <div className={estilos.campo}>
          <label htmlFor="horaInicio">Das</label>
          <input
            id="horaInicio"
            name="horaInicio"
            type="time"
            required
            defaultValue={valores?.horaInicio ?? '09:00'}
          />
        </div>
        <div className={estilos.campo}>
          <label htmlFor="horaFim">Às</label>
          <input
            id="horaFim"
            name="horaFim"
            type="time"
            required
            defaultValue={valores?.horaFim ?? '12:00'}
          />
        </div>
        <div className={estilos.campo}>
          <label htmlFor="duracaoMinutos">Duração (min)</label>
          <input
            id="duracaoMinutos"
            name="duracaoMinutos"
            type="number"
            min={1}
            placeholder="padrão da agência"
            defaultValue={valores?.duracaoMinutos}
          />
        </div>
      </div>

      <div aria-live="polite">
        {estado.tipo === 'erro' && (
          <p role="alert" className={estilos.erro}>
            {estado.mensagem}
          </p>
        )}
        {estado.tipo === 'salva' && (
          <p role="status">Janela salva para {estado.quantidade} dia(s).</p>
        )}
      </div>

      <button type="submit" disabled={pendente} className={estilos.botao}>
        {pendente ? 'Salvando…' : 'Adicionar janela'}
      </button>
    </form>
  );
}
