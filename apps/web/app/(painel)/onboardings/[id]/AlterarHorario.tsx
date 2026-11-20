'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import estilos from './detalhe.module.css';
import { mensagemDeErro } from './tipos';

/**
 * A agência muda o horário da reunião ou da captação (S8-4): qualquer data e hora futura, sem bater
 * com outro agendamento. Não gasta o limite do cliente, que recebe o aviso do novo horário.
 */
export function AlterarHorario({ agendamentoId }: { agendamentoId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!aberto) {
    return (
      <div className={estilos.botoes}>
        <button
          type="button"
          onClick={() => {
            setAberto(true);
          }}
        >
          Alterar horário
        </button>
      </div>
    );
  }

  async function salvar() {
    if (data === '' || hora === '') {
      setErro('Escolha a data e a hora.');
      return;
    }
    setOcupado(true);
    setErro(null);
    const r = await fetch(`/api/agendamentos/${agendamentoId}/horario`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data, hora }),
    });
    setOcupado(false);
    if (!r.ok) {
      setErro(await mensagemDeErro(r));
      return;
    }
    setAberto(false);
    router.refresh();
  }

  return (
    <form
      className={estilos.confirmacao}
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <div className={estilos.dataHora}>
        <label>
          Nova data
          <input
            type="date"
            value={data}
            required
            onChange={(e) => {
              setData(e.target.value);
            }}
          />
        </label>
        <label>
          Hora
          <input
            type="time"
            value={hora}
            required
            onChange={(e) => {
              setHora(e.target.value);
            }}
          />
        </label>
      </div>
      <p className={estilos.dica}>O cliente recebe um aviso com o novo horário.</p>
      {erro && (
        <p role="alert" className={estilos.erro}>
          {erro}
        </p>
      )}
      <div className={estilos.botoes}>
        <button type="submit" disabled={ocupado}>
          Salvar horário
        </button>
        <button
          type="button"
          className={estilos.secundario}
          onClick={() => {
            setAberto(false);
            setErro(null);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
