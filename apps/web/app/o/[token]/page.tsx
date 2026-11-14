import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { URL_API } from '../../_lib/url-api';
import { NavegacaoEtapas, type EtapaId, type EtapaNavegacao } from './_componentes/NavegacaoEtapas';
import { Consentimento } from './_consentimento/Consentimento';
import { EtapaAcessos } from './_etapas/acessos/EtapaAcessos';
import { EtapaCaptacao } from './_etapas/captacao/EtapaCaptacao';
import { EtapaFormulario } from './_etapas/formulario/EtapaFormulario';
import { EtapaReuniao } from './_etapas/reuniao/EtapaReuniao';
import estilos from './onboarding.module.css';

export const metadata: Metadata = { title: 'Seu onboarding' };

interface Visao {
  empresa: string;
}
interface Termo {
  termo: { versao: string; texto: string };
  aceitoEm: string | null;
}

interface Etapas {
  etapas: EtapaNavegacao[];
  atual: EtapaId;
}

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

/**
 * Página do cliente (link único, sem login, RN-01). Cada etapa vive em _etapas/<etapa>/; a casca
 * cuida da ordem e da navegação (RN-79).
 */
export default async function PaginaOnboarding({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { onboarding } = (await (await chamar(token, '')).json()) as { onboarding: Visao };
  // Abrir o link pela primeira vez inicia o andamento (RN-50); repetir não muda nada.
  await chamar(token, '/abrir', 'POST');
  const consentimento = (await (await chamar(token, '/consentimento')).json()) as Termo;

  if (consentimento.aceitoEm === null) {
    return <Consentimento token={token} empresa={onboarding.empresa} termo={consentimento.termo} />;
  }

  // Liberação sequencial (RN-79): o que está liberado e onde a página abre.
  const { etapas, atual } = (await (await chamar(token, '/etapas')).json()) as Etapas;
  return (
    <main className={estilos.pagina}>
      <h1>Olá, {onboarding.empresa}!</h1>
      <p className={estilos.subtitulo}>4 passos para começarmos o seu conteúdo.</p>
      <NavegacaoEtapas
        etapas={etapas}
        atual={atual}
        paineis={{
          formulario: <EtapaFormulario token={token} />,
          acessos: <EtapaAcessos token={token} />,
          reuniao: <EtapaReuniao token={token} />,
          captacao: <EtapaCaptacao token={token} />,
        }}
      />
    </main>
  );
}
