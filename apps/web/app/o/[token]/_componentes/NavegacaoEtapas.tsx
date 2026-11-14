'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContextoAvanco, type AvancoEtapa } from './avanco';
import { BarraProgresso } from './BarraProgresso';
import { descreverEtapa, IconeEtapa, type EstadoIcone } from '../../../_componentes/IconeEtapa';
import estilos from './navegacao.module.css';

export type EtapaId = 'formulario' | 'acessos' | 'reuniao' | 'captacao';

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

function estadoDoIcone(e: EtapaNavegacao): EstadoIcone {
  if (!e.liberada) return 'bloqueada';
  if (e.status === 'concluida') return 'concluida';
  if (e.status === 'em_andamento' || e.feita) return 'em_andamento';
  return 'pendente';
}

/**
 * Casca da página do cliente (S6-4, RN-79): barra de progresso e um botão por etapa no topo; mostra
 * uma etapa por vez. Etapa bloqueada abre só para leitura, com alerta. As etapas chamam
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
        <BarraProgresso concluidas={concluidas} total={etapas.length} />
        <nav aria-label="Etapas">
          <ol className={estilos.botoes}>
            {etapas.map((e, i) => {
              const estado = estadoDoIcone(e);
              return (
                <li key={e.etapa}>
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
                    <IconeEtapa
                      estado={estado}
                      numero={i + 1}
                      rotulo={ROTULO[e.etapa]}
                      decorativo
                    />
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

      {etapas.map((e) => (
        <section
          key={e.etapa}
          hidden={aberta !== e.etapa}
          aria-label={ROTULO[e.etapa]}
          className={estilos.painel}
        >
          {!e.liberada && (
            <p role="status" className={estilos.alerta}>
              <span aria-hidden="true">🔒</span> {ALERTA[e.etapa]} As etapas anteriores precisam ser
              concluídas.
            </p>
          )}
          <ContextoAvanco.Provider value={contextos.get(e.etapa) ?? SEM_AVANCO}>
            <div inert={!e.liberada} className={e.liberada ? undefined : estilos.inerte}>
              {paineis[e.etapa]}
            </div>
          </ContextoAvanco.Provider>
        </section>
      ))}
    </>
  );
}
