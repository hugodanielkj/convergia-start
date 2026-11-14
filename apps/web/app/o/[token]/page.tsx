import type { ComponentType } from 'react';
import { BarraProgresso } from './_componentes/BarraProgresso';
import { EtapaAcessos } from './_etapas/acessos/EtapaAcessos';
import { EtapaCaptacao } from './_etapas/captacao/EtapaCaptacao';
import { EtapaFormulario } from './_etapas/formulario/EtapaFormulario';
import { EtapaReuniao } from './_etapas/reuniao/EtapaReuniao';
import estilos from './onboarding.module.css';

/**
 * Casca da página do cliente (link único, sem login, RN-01). Cada etapa vive em
 * _etapas/<etapa>/ e pertence a uma trilha: formulário e acessos (A), reunião e captação (B).
 * Os dados reais (agência, status, token) entram na S1-5 e na S2-1.
 */
const ETAPAS: { id: string; Componente: ComponentType }[] = [
  { id: 'formulario', Componente: EtapaFormulario },
  { id: 'acessos', Componente: EtapaAcessos },
  { id: 'reuniao', Componente: EtapaReuniao },
  { id: 'captacao', Componente: EtapaCaptacao },
];

export default function PaginaOnboarding() {
  return (
    <main className={estilos.pagina}>
      <h1>Bem-vindo(a)!</h1>
      <p className={estilos.subtitulo}>
        Em poucos minutos você deixa tudo pronto para começarmos a produzir o seu conteúdo.
      </p>
      <BarraProgresso concluidas={0} total={ETAPAS.length} />
      <ol className={estilos.etapas}>
        {ETAPAS.map(({ id, Componente }) => (
          <li key={id}>
            <Componente />
          </li>
        ))}
      </ol>
    </main>
  );
}
