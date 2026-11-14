import { estadoDaEtapa, ROTULO_ETAPA } from '../../_componentes/estado-etapa';
import { IconeEtapa } from '../../_componentes/IconeEtapa';
import estilos from './onboardings.module.css';

/** Progresso do onboarding no painel (S6-5): um ícone por etapa, com nome acessível e tooltip. */
export function ProgressoEtapas({
  etapas,
}: {
  etapas: readonly { tipo: string; status: string; liberada: boolean }[];
}) {
  return (
    <ol className={estilos.progresso} aria-label="Progresso das etapas">
      {etapas.map((e, i) => (
        <li key={e.tipo}>
          <IconeEtapa
            estado={estadoDaEtapa(e)}
            numero={i + 1}
            rotulo={ROTULO_ETAPA[e.tipo] ?? e.tipo}
          />
        </li>
      ))}
    </ol>
  );
}

const LEGENDA = [
  { estado: 'concluida', texto: 'concluída' },
  { estado: 'em_andamento', texto: 'em andamento' },
  { estado: 'pendente', texto: 'pendente' },
  { estado: 'bloqueada', texto: 'bloqueada' },
] as const;

/** Legenda visível dos ícones: no celular não há hover para ler o tooltip (decisão mobile-first). */
export function LegendaProgresso() {
  return (
    <ul className={estilos.legenda} aria-label="Legenda do progresso">
      {LEGENDA.map((l, i) => (
        <li key={l.estado}>
          <IconeEtapa estado={l.estado} numero={i + 1} rotulo="Etapa" decorativo />
          {l.texto}
        </li>
      ))}
    </ul>
  );
}
