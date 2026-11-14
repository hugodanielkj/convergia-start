'use client';

import { useState } from 'react';
import { EscolhaPlataformas } from './EscolhaPlataformas';
import estilos from './personalizar.module.css';
import { MENSAGEM_ACESSOS_TRAVADA, MENSAGEM_NENHUMA, type EstadoAcessos } from './tipos';

type Aviso = { tom: 'ok' | 'erro'; texto: string } | null;

const marcadas = (e: EstadoAcessos) =>
  e.plataformas.filter((p) => p.escolhida).map((p) => p.plataforma);

/** Edição posterior das plataformas do cliente (S6-3, RN-27), até a etapa começar. */
export function PersonalizarAcessos({
  onboardingId,
  inicial,
}: {
  onboardingId: string;
  inicial: EstadoAcessos;
}) {
  const [estado, setEstado] = useState(inicial);
  const [escolhidas, setEscolhidas] = useState<string[]>(marcadas(inicial));
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const sujo = escolhidas.join() !== marcadas(estado).join();

  async function salvar() {
    setOcupado(true);
    setAviso(null);
    const resposta = await fetch(
      `/api/onboardings/${encodeURIComponent(onboardingId)}/acessos/escolha`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plataformas: escolhidas }),
      },
    ).catch(() => null);
    const corpo = (await resposta?.json().catch(() => ({}))) as
      (EstadoAcessos & { erro?: string }) | undefined;
    if (resposta?.ok && corpo) {
      setEstado(corpo);
      setEscolhidas(marcadas(corpo));
      setAviso({ tom: 'ok', texto: 'Plataformas salvas.' });
    } else if (corpo?.erro === 'ESCOLHA_TRAVADA') {
      setEstado({ ...estado, travada: true });
      setAviso({ tom: 'erro', texto: MENSAGEM_ACESSOS_TRAVADA });
    } else {
      setAviso({ tom: 'erro', texto: 'Não foi possível salvar.' });
    }
    setOcupado(false);
  }

  return (
    <section className={estilos.bloco} aria-labelledby="titulo-acessos">
      <header className={estilos.cabecalho}>
        <h2 id="titulo-acessos">Acessos</h2>
        <span className={estilos.selo}>{String(escolhidas.length)} plataformas</span>
      </header>
      {estado.travada && (
        <p role="status" className={estilos.travada}>
          🔒 {MENSAGEM_ACESSOS_TRAVADA}
        </p>
      )}
      {aviso && (
        <p role={aviso.tom === 'erro' ? 'alert' : 'status'} className={estilos[aviso.tom]}>
          {aviso.texto}
        </p>
      )}
      <fieldset disabled={estado.travada || ocupado} className={estilos.campos}>
        <EscolhaPlataformas
          opcoes={estado.plataformas}
          escolhidas={escolhidas}
          aoMudar={setEscolhidas}
        />
        <div className={estilos.rodape}>
          <button
            type="button"
            className={estilos.primario}
            disabled={!sujo || escolhidas.length === 0}
            title={escolhidas.length === 0 ? MENSAGEM_NENHUMA : undefined}
            onClick={() => void salvar()}
          >
            Salvar acessos
          </button>
        </div>
      </fieldset>
    </section>
  );
}
