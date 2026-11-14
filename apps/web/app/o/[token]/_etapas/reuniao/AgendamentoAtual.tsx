'use client';

import { useEffect, useState } from 'react';
import type { AgendamentoDoCliente } from './api';
import { formatarDiaEHora, fusoDoNavegador } from './formatar';
import estilos from './reuniao.module.css';
import { SeletorHorario } from './SeletorHorario';

const MENSAGEM_SEM_REAGENDAR =
  'Precisa remarcar? Os reagendamentos por aqui já acabaram ou o prazo passou. Entre em contato com a agência.';

/** A reunião marcada, no fuso do cliente, com a opção de reagendar enquanto puder (RN-35). */
export function AgendamentoAtual({
  agendamento,
  token,
}: {
  agendamento: AgendamentoDoCliente;
  token: string;
}) {
  const [fuso, setFuso] = useState<string | null>(null);
  const [reagendando, setReagendando] = useState(false);

  useEffect(() => {
    setFuso(fusoDoNavegador());
  }, []);

  return (
    <div className={estilos.agendado}>
      <p>
        Sua reunião online está marcada para{' '}
        <strong>
          <time dateTime={agendamento.inicio}>
            {fuso === null ? '…' : formatarDiaEHora(agendamento.inicio, fuso)}
          </time>
        </strong>
        {fuso !== null && <span className={estilos.ajuda}> ({fuso.replaceAll('_', ' ')})</span>}.
      </p>
      <p className={estilos.ajuda}>
        O link da videochamada chega por mensagem assim que a agência confirmar.
      </p>

      {!reagendando && agendamento.podeReagendar && (
        <div className={estilos.acoes}>
          <button
            type="button"
            className={estilos.botaoSecundario}
            onClick={() => {
              setReagendando(true);
            }}
          >
            Reagendar
          </button>
          <span className={estilos.ajuda}>
            Você ainda pode reagendar {agendamento.reagendamentosRestantes} vez(es).
          </span>
        </div>
      )}
      {!agendamento.podeReagendar && <p className={estilos.ajuda}>{MENSAGEM_SEM_REAGENDAR}</p>}

      {reagendando && (
        <SeletorHorario
          token={token}
          modo={{ tipo: 'reagendar', agendamentoId: agendamento.id }}
          aoCancelar={() => {
            setReagendando(false);
          }}
          aoConcluir={() => {
            setReagendando(false);
          }}
        />
      )}
    </div>
  );
}
