import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { URL_API } from '../../../_lib/url-api';
import { DetalheOnboarding } from './DetalheOnboarding';
import type { Detalhe, ItemAuditoria } from './tipos';

export const metadata: Metadata = { title: 'Onboarding · Convergia Start' };
export const dynamic = 'force-dynamic';

export default async function PaginaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookie = (await cookies()).toString();
  const buscar = (caminho: string) =>
    fetch(`${URL_API}/onboardings/${encodeURIComponent(id)}${caminho}`, {
      headers: { cookie },
      cache: 'no-store',
    });
  const [detalhe, auditoria] = await Promise.all([buscar('/detalhe'), buscar('/auditoria')]);
  if (detalhe.status === 404 || detalhe.status === 403) notFound();
  if (!detalhe.ok || !auditoria.ok) {
    throw new Error(`API respondeu ${String(detalhe.status)} no detalhe do onboarding`);
  }
  const { itens } = (await auditoria.json()) as { itens: ItemAuditoria[] };
  return <DetalheOnboarding detalhe={(await detalhe.json()) as Detalhe} linhaDoTempo={itens} />;
}
