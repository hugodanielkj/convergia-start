'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContextoAvanco, type AvancoEtapa } from './avanco';
import { ContextoPasso, type EtapaId } from './passo';
import { estadoDaEtapa } from '../../../_componentes/estado-etapa';
import { descreverEtapa, IconeEtapa } from '../../../_componentes/IconeEtapa';
import estilos from './navegacao.module.css';

export type { EtapaId } from './passo';

export interface EtapaNavegacao {
  etapa: EtapaId;
  liberada: boolean;
  feita: boolean;
  status: string;
}

const SEM_AVANCO: AvancoEtapa = { avancar: () => undefined };

const ROTULO: Record<EtapaId, string> = {
  formulario: 'Formulário',
  acessos: 'Acessos',
  reuniao: 'Reunião',
  captacao: 'Captação',
};

const ALERTA: Record<EtapaId, string> = {
  formulario: '',
  acessos: 'Envie o formulário para liberar esta etapa.',
  reuniao: 'Avise em todas as redes que adicionou a agência para liberar esta etapa.',
  captacao: 'Agende a reunião para liberar esta etapa.',
};

/** Etapa anterior que ainda pede ação do cliente: é para lá que o botão do alerta leva. */
function pendenteAntes(etapas: EtapaNavegacao[], etapa: EtapaId): EtapaNavegacao | undefined {
  const indice = etapas.findIndex((e) => e.etapa === etapa);
  return etapas.slice(0, indice).find((e) => e.liberada && !e.feita && e.status !== 'concluida');
}

/**
 * Casca da página do cliente (S6-4, RN-79): linha do tempo com os 4 passos no topo e uma etapa por
 * vez. Etapa bloqueada abre só para leitura, com alerta e atalho para o que falta. As etapas chamam
 * `useAvancoEtapa().avancar()` ao concluir e a casca leva o cliente para a próxima.
 */
export function NavegacaoEtapas({
  etapas,
  atual,
  paineis,
}: {
  etapas: EtapaNavegacao[];
  atual: EtapaId;
  paineis: Record<EtapaId, ReactNode>;
}) {
  const router = useRouter();
  const [aberta, setAberta] = useState<EtapaId>(atual);
  const topo = useRef<HTMLDivElement>(null);
  // Pedido de avanço feito com estes dados; só age quando o refresh trouxer dados novos.
  const pedido = useRef<{ de: EtapaId; antes: EtapaNavegacao[] } | null>(null);

  const abrir = (etapa: EtapaId) => {
    setAberta(etapa);
    topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const p = pedido.current;
    if (!p || p.antes === etapas) return;
    pedido.current = null;
    const proxima = etapas[etapas.findIndex((e) => e.etapa === p.de) + 1];
    if (!proxima) return;
    setAberta(proxima.etapa);
    topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [etapas]);

  const contextos = useMemo(() => {
    const porEtapa = new Map<EtapaId, AvancoEtapa>();
    for (const e of etapas) {
      porEtapa.set(e.etapa, {
        avancar: () => {
          pedido.current = { de: e.etapa, antes: etapas };
          router.refresh();
        },
      });
    }
    return porEtapa;
  }, [etapas, router]);

  const concluidas = etapas.filter((e) => e.status === 'concluida').length;

  return (
    <>
      <div ref={topo} className={estilos.topo}>
        <p className={estilos.progresso}>
          {concluidas} de {etapas.length} etapas concluídas
        </p>
        <nav aria-label="Etapas">
          <ol className={estilos.passos}>
            {etapas.map((e, i) => {
              const estado = estadoDaEtapa(e);
              return (
                <li key={e.etapa} className={estilos.passo} data-estado={estado}>
                  <button
                    type="button"
                    className={estilos.botao}
                    aria-current={aberta === e.etapa ? 'step' : undefined}
                    aria-label={descreverEtapa(ROTULO[e.etapa], estado)}
                    title={descreverEtapa(ROTULO[e.etapa], estado)}
                    onClick={() => {
                      setAberta(e.etapa);
                    }}
                  >
                    <span className={estilos.marco}>
                      <IconeEtapa
                        estado={estado}
                        numero={i + 1}
                        rotulo={ROTULO[e.etapa]}
                        decorativo
                      />
                    </span>
                    <span className={estilos.rotulo} aria-hidden="true">
                      {ROTULO[e.etapa]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {etapas.map((e, i) => {
        const falta = e.liberada ? undefined : pendenteAntes(etapas, e.etapa);
        return (
          <section
            key={e.etapa}
            hidden={aberta !== e.etapa}
            aria-label={ROTULO[e.etapa]}
            className={estilos.painel}
          >
            {!e.liberada && (
              <div role="status" className={estilos.alerta}>
                <p>
                  <span aria-hidden="true">🔒</span> {ALERTA[e.etapa]}
                </p>
                {falta && (
                  <button
                    type="button"
                    className={estilos.atalho}
                    onClick={() => {
                      abrir(falta.etapa);
                    }}
                  >
                    Ir para {ROTULO[falta.etapa]}
                  </button>
                )}
              </div>
            )}
            <ContextoPasso.Provider value={{ etapa: e.etapa, numero: i + 1, total: etapas.length }}>
              <ContextoAvanco.Provider value={contextos.get(e.etapa) ?? SEM_AVANCO}>
                <div inert={!e.liberada} className={e.liberada ? undefined : estilos.inerte}>
                  {paineis[e.etapa]}
                </div>
              </ContextoAvanco.Provider>
            </ContextoPasso.Provider>
          </section>
        );
      })}
    </>
  );
}
