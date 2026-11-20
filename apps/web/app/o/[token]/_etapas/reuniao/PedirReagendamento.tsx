'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { criarApiReuniao, type AgendamentoDoCliente } from './api';
import estilos from './reuniao.module.css';

const MOTIVO_MAX = 300;

/**
 * Sem reagendamentos por aqui (limite ou antecedência, RN-35): o cliente pede à agência, com um
 * motivo, e a agência combina o novo horário (S8-4).
 */
export function PedirReagendamento({
  agendamento,
  token,
}: {
  agendamento: AgendamentoDoCliente;
  token: string;
}) {
  const roteador = useRouter();
  const api = useMemo(
    () => criarApiReuniao({ baseUrl: '/api', fetcher: (...args) => fetch(...args) }),
    [],
  );
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviado, setEnviado] = useState(agendamento.pedidoEnviado);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (enviado) {
    return (
      <p className={estilos.ajuda} role="status">
        Pedido de reagendamento enviado. A agência vai falar com você para combinar o novo horário.
      </p>
    );
  }

  async function enviar() {
    if (motivo.trim() === '') {
      setErro('Conte em poucas palavras por que precisa remarcar.');
      return;
    }
    setOcupado(true);
    setErro(null);
    const r = await api.pedirReagendamento(token, agendamento.id, motivo.trim());
    setOcupado(false);
    if (r.tipo === 'ok') {
      setEnviado(true);
      return;
    }
    if (r.tipo === 'expirado' || r.tipo === 'invalido') {
      roteador.refresh();
      return;
    }
    setErro(r.mensagem);
  }

  if (!aberto) {
    return (
      <div className={estilos.acoes}>
        <p className={estilos.ajuda}>
          Precisa remarcar? Os reagendamentos por aqui já acabaram ou o prazo passou, mas você pode
          pedir à agência.
        </p>
        <button
          type="button"
          className={estilos.botaoSecundario}
          onClick={() => {
            setAberto(true);
          }}
        >
          Pedir para reagendar
        </button>
      </div>
    );
  }

  return (
    <form
      className={estilos.pedido}
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <label htmlFor={`motivo-${agendamento.id}`}>Por que precisa remarcar?</label>
      <textarea
        id={`motivo-${agendamento.id}`}
        value={motivo}
        maxLength={MOTIVO_MAX}
        rows={3}
        onChange={(e) => {
          setMotivo(e.target.value);
        }}
      />
      {erro && (
        <p className={estilos.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={estilos.acoes}>
        <button type="submit" className={estilos.botao} disabled={ocupado}>
          {ocupado ? 'Enviando…' : 'Enviar pedido'}
        </button>
        <button
          type="button"
          className={estilos.botaoSecundario}
          onClick={() => {
            setAberto(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
