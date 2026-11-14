'use client';

import { useState } from 'react';
import estilos from './acessos.module.css';
import { ROTULO_ETAPA, rotuloAcesso, type EstadoAcessos } from './tipos';

export function AcessosAgencia({
  onboardingId,
  inicial,
}: {
  onboardingId: string;
  inicial: EstadoAcessos;
}) {
  const [estado, setEstado] = useState(inicial);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function marcar(plataforma: string, status: 'concedido' | 'invalido') {
    setOcupado(plataforma);
    setErro(null);
    const r = await fetch(`/api/onboardings/${onboardingId}/acessos/${plataforma}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, motivo: motivos[plataforma] }),
    });
    setOcupado(null);
    if (!r.ok) {
      const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
      setErro(corpo.mensagem ?? 'Não foi possível salvar.');
      return;
    }
    setEstado((await r.json()) as EstadoAcessos);
    setMotivos((m) => ({ ...m, [plataforma]: '' }));
  }

  return (
    <>
      <h1>Acessos do cliente</h1>
      <p>
        Etapa: <strong>{ROTULO_ETAPA[estado.etapa]}</strong>. Confirme só depois de ver a agência
        como parceira na rede.
      </p>
      <ul className={estilos.lista}>
        {estado.plataformas.map((a) => (
          <li key={a.plataforma} className={estilos.item}>
            <div className={estilos.topo}>
              <strong>
                {a.nome} {a.obrigatoria ? null : <small>(opcional)</small>}
              </strong>
              <span className={estilos.selo} data-status={a.status}>
                {rotuloAcesso(a)}
              </span>
            </div>
            {a.status === 'invalido' && a.motivo ? (
              <p className={estilos.motivo}>Motivo: {a.motivo}</p>
            ) : null}
            <div className={estilos.acoes}>
              <input
                aria-label={`Motivo para ${a.nome}`}
                placeholder="Motivo (obrigatório se inválido)"
                value={motivos[a.plataforma] ?? ''}
                maxLength={500}
                onChange={(e) => {
                  setMotivos({ ...motivos, [a.plataforma]: e.target.value });
                }}
              />
              <button
                type="button"
                disabled={ocupado === a.plataforma || a.status === 'concedido'}
                onClick={() => void marcar(a.plataforma, 'concedido')}
              >
                Marcar concedido
              </button>
              <button
                type="button"
                className={estilos.perigo}
                disabled={ocupado === a.plataforma}
                onClick={() => void marcar(a.plataforma, 'invalido')}
              >
                Marcar inválido
              </button>
            </div>
          </li>
        ))}
      </ul>
      {erro ? <p className={estilos.erro}>{erro}</p> : null}
    </>
  );
}
