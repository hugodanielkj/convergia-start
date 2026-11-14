import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { URL_API } from '../../../_lib/url-api';
import { EditorTemplates, type Template } from './EditorTemplates';

export const metadata: Metadata = { title: 'Mensagens · Convergia Start' };
export const dynamic = 'force-dynamic';

export default async function ConfigTemplates() {
  const resposta = await fetch(`${URL_API}/templates`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (resposta.status === 403) {
    return (
      <>
        <h1>Mensagens</h1>
        <p>Só o administrador da agência pode editar os textos.</p>
      </>
    );
  }
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} em /templates`);
  const { templates, variaveis } = (await resposta.json()) as {
    templates: Template[];
    variaveis: string[];
  };
  return <EditorTemplates inicial={templates} variaveis={variaveis} />;
}
