'use client';

import { useActionState, useState } from 'react';
import { salvarExcecaoAction } from './actions';
import type { EstadoExcecao } from './processar';
import estilos from './agenda.module.css';

const INICIAL: EstadoExcecao = { tipo: 'inicial' };

export interface LinhaHorario {
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracaoMinutos: number | null;
}

interface Props {
  readonly tipo: 'reuniao' | 'captacao';
  readonly rotulo: string;
  readonly data: string;
  readonly iniciais: readonly LinhaHorario[];
  /** O dia já tem horário próprio (diferente do padrão da semana). */
  readonly personalizado: boolean;
  /** Dia que passou ou sem permissão: só mostra o horário. */
  readonly somenteLeitura: boolean;
}

interface Linha {
  readonly chave: number;
  readonly horaInicio: string;
  readonly horaFim: string;
  readonly duracao: string;
}

/** Horário de um tipo (reunião ou captação) num dia: parte do padrão e deixa mudar só nesta data. */
export function EditorDia({ tipo, rotulo, data, iniciais, personalizado, somenteLeitura }: Props) {
  const [estado, salvar, pendente] = useActionState(salvarExcecaoAction, INICIAL);
  const [proxima, setProxima] = useState(iniciais.length);
  const [linhas, setLinhas] = useState<Linha[]>(
    iniciais.map((l, i) => ({
      chave: i,
      horaInicio: l.horaInicio,
      horaFim: l.horaFim,
      duracao: l.duracaoMinutos === null ? '' : String(l.duracaoMinutos),
    })),
  );

  const mudar = (chave: number, campo: 'horaInicio' | 'horaFim' | 'duracao', valor: string) => {
    setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  };

  function adicionar() {
    setLinhas((atuais) => [
      ...atuais,
      { chave: proxima, horaInicio: '09:00', horaFim: '12:00', duracao: '' },
    ]);
    setProxima(proxima + 1);
  }

  if (somenteLeitura) {
    return (
      <div className={estilos.editorDia}>
        <h4>{rotulo}</h4>
        {linhas.length === 0 ? (
          <p className={estilos.vazio}>Sem atendimento.</p>
        ) : (
          <ul className={estilos.horariosDoDia}>
            {linhas.map((l) => (
              <li key={l.chave}>
                {l.horaInicio} às {l.horaFim}
                {l.duracao !== '' && ` · ${l.duracao} min cada`}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <form action={salvar} className={estilos.editorDia}>
      <h4>
        {rotulo}
        {personalizado && <span className={estilos.selo}>Alterado neste dia</span>}
      </h4>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="data" value={data} />

      {linhas.length === 0 && (
        <p className={estilos.vazio}>Sem atendimento neste dia. Adicione um horário para abrir.</p>
      )}

      {linhas.map((l, i) => (
        <fieldset key={l.chave} className={estilos.linhaHorario}>
          <legend>Horário {i + 1}</legend>
          <div className={estilos.campo}>
            <label htmlFor={`${tipo}-ini-${String(l.chave)}`}>Das</label>
            <input
              id={`${tipo}-ini-${String(l.chave)}`}
              name="horaInicio"
              type="time"
              required
              value={l.horaInicio}
              onChange={(e) => {
                mudar(l.chave, 'horaInicio', e.target.value);
              }}
            />
          </div>
          <div className={estilos.campo}>
            <label htmlFor={`${tipo}-fim-${String(l.chave)}`}>Às</label>
            <input
              id={`${tipo}-fim-${String(l.chave)}`}
              name="horaFim"
              type="time"
              required
              value={l.horaFim}
              onChange={(e) => {
                mudar(l.chave, 'horaFim', e.target.value);
              }}
            />
          </div>
          <div className={estilos.campo}>
            <label htmlFor={`${tipo}-dur-${String(l.chave)}`}>Duração (min)</label>
            <input
              id={`${tipo}-dur-${String(l.chave)}`}
              name="duracaoMinutos"
              type="number"
              min={1}
              placeholder="padrão da agência"
              value={l.duracao}
              onChange={(e) => {
                mudar(l.chave, 'duracao', e.target.value);
              }}
            />
          </div>
          <button
            type="button"
            className={estilos.botaoSecundario}
            aria-label={`Remover horário ${String(i + 1)} de ${rotulo}`}
            onClick={() => {
              setLinhas((atuais) => atuais.filter((x) => x.chave !== l.chave));
            }}
          >
            Remover
          </button>
        </fieldset>
      ))}

      <div aria-live="polite">
        {estado.tipo === 'erro' && (
          <p role="alert" className={estilos.erro}>
            {estado.mensagem}
          </p>
        )}
        {estado.tipo === 'salva' && (
          <p role="status">
            {estado.padrao ? 'Voltou ao horário padrão.' : 'Horário deste dia salvo.'}
          </p>
        )}
      </div>

      <div className={estilos.acoes}>
        <button type="button" className={estilos.botaoSecundario} onClick={adicionar}>
          Adicionar horário
        </button>
        <button type="submit" disabled={pendente || linhas.length === 0} className={estilos.botao}>
          {pendente ? 'Salvando…' : 'Salvar este dia'}
        </button>
        {personalizado && (
          <button
            type="submit"
            name="acao"
            value="padrao"
            formNoValidate
            disabled={pendente}
            className={estilos.botaoSecundario}
          >
            Voltar ao padrão
          </button>
        )}
      </div>
    </form>
  );
}
