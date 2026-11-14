import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { URL_API } from '../../../../_lib/url-api';
import { PersonalizarAcessos } from './PersonalizarAcessos';
import { PersonalizarPerguntas } from './PersonalizarPerguntas';
import estilos from './personalizar.module.css';
import type { EstadoAcessos, EstadoPerguntas } from './tipos';

export const metadata: Metadata = { title: 'Personalizar · Convergia Start' };
export const dynamic = 'force-dynamic';

/** Personalização por cliente depois do cadastro (S6-2): trava quando o cliente começa. */
export default async function PaginaPersonalizar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookie = (await cookies()).toString();
  const buscar = (caminho: string) =>
    fetch(`${URL_API}/onboardings/${encodeURIComponent(id)}${caminho}`, {
      headers: { cookie },
      cache: 'no-store',
    });
  const [rPerguntas, rAcessos] = await Promise.all([
    buscar('/formulario/personalizacao'),
    buscar('/acessos/escolha'),
  ]);
  if ([404, 403].includes(rPerguntas.status)) notFound();
  if (!rPerguntas.ok || !rAcessos.ok) {
    throw new Error(`API respondeu ${String(rPerguntas.status)} na personalização`);
  }
  const perguntas = (await rPerguntas.json()) as EstadoPerguntas;
  const acessos = (await rAcessos.json()) as EstadoAcessos;

  return (
    <div className={estilos.pagina}>
      <Link href={`/onboardings/${id}`} className={estilos.voltar}>
        ← Onboarding
      </Link>
      <h1>Personalizar</h1>
      <PersonalizarPerguntas onboardingId={id} inicial={perguntas} />
      <PersonalizarAcessos onboardingId={id} inicial={acessos} />
    </div>
  );
}
