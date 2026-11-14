import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ComponentType } from 'react';
import { URL_API } from '../../_lib/url-api';
import { BarraProgresso } from './_componentes/BarraProgresso';
import { Consentimento } from './_consentimento/Consentimento';
import { EtapaAcessos } from './_etapas/acessos/EtapaAcessos';
import { EtapaCaptacao } from './_etapas/captacao/EtapaCaptacao';
import { EtapaFormulario } from './_etapas/formulario/EtapaFormulario';
import { EtapaReuniao } from './_etapas/reuniao/EtapaReuniao';
import estilos from './onboarding.module.css';

export const metadata: Metadata = { title: 'Seu onboarding' };

interface Visao {
  empresa: string;
  etapas: { tipo: string; status: string }[];
}
interface Termo {
  termo: { versao: string; texto: string };
  aceitoEm: string | null;
}

/** Página do cliente (link único, sem login, RN-01). Cada etapa vive em _etapas/<etapa>/. */
const ETAPAS: { id: string; Componente: ComponentType }[] = [
  { id: 'formulario', Componente: EtapaFormulario },
  { id: 'acessos', Componente: EtapaAcessos },
  { id: 'reuniao', Componente: EtapaReuniao },
  { id: 'captacao', Componente: EtapaCaptacao },
];

async function chamar(token: string, caminho: string, metodo: 'GET' | 'POST' = 'GET') {
  const resposta = await fetch(
    `${URL_API}/publico/onboardings/${encodeURIComponent(token)}${caminho}`,
    { method: metodo, cache: 'no-store' },
  );
  if (resposta.status === 410) redirect(`/o/${encodeURIComponent(token)}/expirado`);
  if (resposta.status === 404) notFound();
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} em ${caminho}`);
  return resposta;
}

export default async function PaginaOnboarding({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { onboarding } = (await (await chamar(token, '')).json()) as { onboarding: Visao };
  // Abrir o link pela primeira vez inicia o andamento (RN-50); repetir não muda nada.
  await chamar(token, '/abrir', 'POST');
  const consentimento = (await (await chamar(token, '/consentimento')).json()) as Termo;

  if (consentimento.aceitoEm === null) {
    return <Consentimento token={token} empresa={onboarding.empresa} termo={consentimento.termo} />;
  }

  const concluidas = onboarding.etapas.filter((e) => e.status === 'concluida').length;
  return (
    <main className={estilos.pagina}>
      <h1>Bem-vindo(a), {onboarding.empresa}!</h1>
      <p className={estilos.subtitulo}>
        Em poucos minutos você deixa tudo pronto para começarmos a produzir o seu conteúdo.
      </p>
      <BarraProgresso concluidas={concluidas} total={ETAPAS.length} />
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
