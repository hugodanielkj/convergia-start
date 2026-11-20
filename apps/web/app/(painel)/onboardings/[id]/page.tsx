import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { exigirSessao } from '../../../_lib/sessao';
import { URL_API } from '../../../_lib/url-api';
import type { Responsavel } from '../../clientes/SeletorResponsavel';
import { DetalheOnboarding } from './DetalheOnboarding';
import type { PrazoDoDetalhe } from './PrazoDoOnboarding';
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
  const usuario = await exigirSessao();
  const [detalhe, auditoria, prazo, equipe] = await Promise.all([
    buscar('/detalhe'),
    buscar('/auditoria'),
    buscar('/prazo'),
    usuario.papel === 'admin'
      ? fetch(`${URL_API}/equipe/responsaveis`, { headers: { cookie }, cache: 'no-store' })
      : null,
  ]);
  if (detalhe.status === 404 || detalhe.status === 403) notFound();
  if (!detalhe.ok || !auditoria.ok) {
    throw new Error(`API respondeu ${String(detalhe.status)} no detalhe do onboarding`);
  }
  const { itens } = (await auditoria.json()) as { itens: ItemAuditoria[] };
  // O prazo é um extra: se a rota falhar, a tela mostra "a definir" em vez de quebrar.
  const prazoDoDetalhe: PrazoDoDetalhe = prazo.ok
    ? ((await prazo.json()) as PrazoDoDetalhe)
    : { definido: false };
  return (
    <DetalheOnboarding
      detalhe={(await detalhe.json()) as Detalhe}
      linhaDoTempo={itens}
      prazo={prazoDoDetalhe}
      responsaveis={
        equipe?.ok ? ((await equipe.json()) as { responsaveis: Responsavel[] }).responsaveis : null
      }
    />
  );
}
