import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { URL_API } from '../../../../_lib/url-api';
import { AcessosAgencia } from './AcessosAgencia';
import type { EstadoAcessos } from './tipos';

export const metadata: Metadata = { title: 'Acessos do cliente · Convergia Start' };
export const dynamic = 'force-dynamic';

export default async function PaginaAcessos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resposta = await fetch(`${URL_API}/onboardings/${encodeURIComponent(id)}/acessos`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (resposta.status === 404 || resposta.status === 403) notFound();
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} nos acessos`);
  const estado = (await resposta.json()) as EstadoAcessos;
  return <AcessosAgencia onboardingId={id} inicial={estado} />;
}
