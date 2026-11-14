import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { URL_API } from '../../../../_lib/url-api';
import { PersonalizarPerguntas } from './PersonalizarPerguntas';
import estilos from './personalizar.module.css';
import type { EstadoPerguntas } from './tipos';

export const metadata: Metadata = { title: 'Personalizar · Convergia Start' };
export const dynamic = 'force-dynamic';

/** Personalização por cliente depois do cadastro (S6-2): trava quando o cliente começa. */
export default async function PaginaPersonalizar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookie = (await cookies()).toString();
  const resposta = await fetch(
    `${URL_API}/onboardings/${encodeURIComponent(id)}/formulario/personalizacao`,
    { headers: { cookie }, cache: 'no-store' },
  );
  if (resposta.status === 404 || resposta.status === 403) notFound();
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} na personalização`);
  const perguntas = (await resposta.json()) as EstadoPerguntas;

  return (
    <div className={estilos.pagina}>
      <Link href={`/onboardings/${id}`} className={estilos.voltar}>
        ← Onboarding
      </Link>
      <h1>Personalizar</h1>
      <PersonalizarPerguntas onboardingId={id} inicial={perguntas} />
    </div>
  );
}
