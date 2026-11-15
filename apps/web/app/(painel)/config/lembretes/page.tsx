import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { URL_API } from '../../../_lib/url-api';
import { FormularioLembretes } from './FormularioLembretes';
import type { ConfigLembretes } from './mensagens';

export const metadata: Metadata = { title: 'Lembretes · Convergia Start' };
export const dynamic = 'force-dynamic';

export default async function ConfigLembretesPagina() {
  const resposta = await fetch(`${URL_API}/config/lembretes`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (resposta.status === 403) {
    return (
      <>
        <h1>Lembretes</h1>
        <p>Só o administrador da agência pode alterar os lembretes.</p>
      </>
    );
  }
  if (!resposta.ok)
    throw new Error(`API respondeu ${String(resposta.status)} em /config/lembretes`);
  const { config } = (await resposta.json()) as { config: ConfigLembretes };
  return <FormularioLembretes inicial={config} />;
}
