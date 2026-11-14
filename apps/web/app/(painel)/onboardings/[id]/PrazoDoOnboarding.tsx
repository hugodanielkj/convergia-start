'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROTULO_PRAZO, formatarDataDoPrazo } from '../tipos';
import estilos from './detalhe.module.css';
import { mensagemDeErro } from './tipos';

export type PrazoDoDetalhe =
  | { definido: false }
  | {
      definido: true;
      data: string;
      origem: 'calculado' | 'manual';
      justificativa: string | null;
      indicador: string | null;
    };

/** Prazo de liberação com indicador (RN-48) e ajuste manual com justificativa (RN-47). */
export function PrazoDoOnboarding({ id, prazo }: { id: string; prazo: PrazoDoDetalhe }) {
  const router = useRouter();
  const [ajustando, setAjustando] = useState(false);
  const [data, setData] = useState(prazo.definido ? prazo.data : '');
  const [justificativa, setJustificativa] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setOcupado(true);
    setErro(null);
    const r = await fetch(`/api/onboardings/${encodeURIComponent(id)}/prazo/ajuste`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data, justificativa }),
    });
    setOcupado(false);
    if (!r.ok) {
      setErro(await mensagemDeErro(r));
      return;
    }
    setAjustando(false);
    setJustificativa('');
    router.refresh();
  }

  return (
    <section className={estilos.secao} aria-labelledby="titulo-prazo">
      <h2 id="titulo-prazo">Prazo de liberação</h2>
      {!prazo.definido ? (
        <p className={estilos.dica}>Será definido quando a captação for agendada.</p>
      ) : (
        <>
          <p>
            <strong>{formatarDataDoPrazo(prazo.data)}</strong>
            {prazo.indicador && <> · {ROTULO_PRAZO[prazo.indicador] ?? prazo.indicador}</>}
          </p>
          <p className={estilos.dica}>
            {prazo.origem === 'manual'
              ? `Ajustado à mão: ${prazo.justificativa ?? ''}`
              : 'Calculado a partir da data da captação, em dias úteis.'}
          </p>
          {!ajustando ? (
            <div className={estilos.botoes}>
              <button
                type="button"
                onClick={() => {
                  setAjustando(true);
                  setErro(null);
                }}
              >
                Ajustar prazo
              </button>
            </div>
          ) : (
            <form
              className={estilos.confirmacao}
              onSubmit={(e) => {
                e.preventDefault();
                void enviar();
              }}
            >
              <strong>Ajustar prazo</strong>
              <p>O cliente será avisado da nova data.</p>
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
                Justificativa
                <textarea
                  value={justificativa}
                  maxLength={500}
                  required
                  onChange={(e) => {
                    setJustificativa(e.target.value);
                  }}
                />
              </label>
              {erro && <p className={estilos.erro}>{erro}</p>}
              <div className={estilos.botoes}>
                <button type="submit" disabled={ocupado || justificativa.trim() === ''}>
                  {ocupado ? 'Enviando…' : 'Confirmar'}
                </button>
                <button
                  type="button"
                  className={estilos.secundario}
                  onClick={() => {
                    setAjustando(false);
                  }}
                >
                  Voltar
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
