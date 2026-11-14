import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { URL_API } from '../../../_lib/url-api';
import { EditorFormulario } from './editor';
import type { EstadoModelo } from './tipos';

export const metadata: Metadata = { title: 'Modelo do formulário · Convergia Start' };

export default async function ConfigFormulario() {
  const resposta = await fetch(`${URL_API}/formulario/modelo`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });

  if (resposta.status === 403) {
    return (
      <>
        <h1>Modelo do formulário</h1>
        <p>Só o administrador da agência pode editar o modelo do formulário.</p>
      </>
    );
  }
  if (!resposta.ok)
    throw new Error(`API respondeu ${String(resposta.status)} em /formulario/modelo`);

  const estado = (await resposta.json()) as EstadoModelo;
  return <EditorFormulario inicial={estado} />;
}
