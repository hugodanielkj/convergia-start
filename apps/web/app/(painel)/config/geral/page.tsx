import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { URL_API } from '../../../_lib/url-api';
import type { ConfigGeral, Limites } from './campos';
import { FormularioGeral } from './FormularioGeral';

export const metadata: Metadata = { title: 'Geral · Convergia Start' };
export const dynamic = 'force-dynamic';

/** Configurações › Geral (S8-2, RN-03). */
export default async function ConfigGeralPagina() {
  const resposta = await fetch(`${URL_API}/config/geral`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (resposta.status === 403) {
    return (
      <>
        <h1>Geral</h1>
        <p>Só o administrador da agência altera prazos e regras.</p>
      </>
    );
  }
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} em /config/geral`);
  const dados = (await resposta.json()) as {
    config: ConfigGeral;
    limites: Limites;
    nomeMax: number;
  };
  return <FormularioGeral inicial={dados.config} limites={dados.limites} nomeMax={dados.nomeMax} />;
}
