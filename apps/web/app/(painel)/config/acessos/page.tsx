import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { URL_API } from '../../../_lib/url-api';
import { FormularioIdentificadores } from './FormularioIdentificadores';

export const metadata: Metadata = { title: 'Acessos · Convergia Start' };

export default async function ConfigAcessos() {
  const resposta = await fetch(`${URL_API}/acessos/config`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (resposta.status === 403) {
    return (
      <>
        <h1>Acessos das redes</h1>
        <p>Só o administrador da agência pode definir os identificadores.</p>
      </>
    );
  }
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} em /acessos/config`);
  const { identificadores } = (await resposta.json()) as {
    identificadores: Record<string, string>;
  };
  return <FormularioIdentificadores inicial={identificadores} />;
}
