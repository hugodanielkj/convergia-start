import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { exigirSessao } from '../../../_lib/sessao';
import { URL_API } from '../../../_lib/url-api';
import { Equipe } from './Equipe';
import type { PessoaEquipe } from './mensagens';

export const metadata: Metadata = { title: 'Equipe · Convergia Start' };
export const dynamic = 'force-dynamic';

/** Configurações › Equipe (S8-1, RN-03). */
export default async function ConfigEquipe() {
  const usuario = await exigirSessao();
  const resposta = await fetch(`${URL_API}/equipe`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (resposta.status === 403) {
    return (
      <>
        <h1>Equipe</h1>
        <p>Só o administrador da agência cadastra e altera a equipe.</p>
      </>
    );
  }
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} em /equipe`);
  const { pessoas } = (await resposta.json()) as { pessoas: PessoaEquipe[] };
  return <Equipe pessoas={pessoas} euId={usuario.id} />;
}
