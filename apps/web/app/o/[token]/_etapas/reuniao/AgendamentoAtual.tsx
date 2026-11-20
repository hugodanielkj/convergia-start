'use client';

import { useEffect, useState } from 'react';
import type { AgendamentoDoCliente } from './api';
import { fusoDoNavegador } from './formatar';
import { HorarioMarcado } from './HorarioMarcado';
import estilos from './reuniao.module.css';
import { PedirReagendamento } from './PedirReagendamento';
import { SeletorHorario } from './SeletorHorario';

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
      <HorarioMarcado
        rotulo="Sua reunião online está marcada para"
        instante={agendamento.inicio}
        fuso={fuso}
      >
        {/* Sem Google Meet (decisão 2026-11-15-a-sem-google-calendar): o link vem da agência. */}
        <p className={estilos.ajuda}>A agência vai te enviar o link da videochamada.</p>
      </HorarioMarcado>

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
      {!agendamento.podeReagendar && <PedirReagendamento agendamento={agendamento} token={token} />}

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
