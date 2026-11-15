import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { URL_API } from '../../_lib/url-api';
import { formatarDataHora } from '../clientes/formatar';
import { BotaoResolver } from './BotaoResolver';
import estilos from './avisos.module.css';

export const metadata: Metadata = { title: 'Avisos · Convergia Start' };
export const dynamic = 'force-dynamic';

interface Aviso {
  id: string;
  texto: string;
  onboardingId: string;
  criadoEm: string;
  resolvidoEm: string | null;
}

/** Avisos internos da agência (RN-58): o Admin vê todos; o membro, os dos seus onboardings. */
export default async function Avisos({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  const situacao = (await searchParams).situacao === 'resolvidos' ? 'resolvidos' : 'abertos';
  const resposta = await fetch(`${URL_API}/alertas?situacao=${situacao}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} em /alertas`);
  const { avisos } = (await resposta.json()) as { avisos: Aviso[] };

  return (
    <>
      <h1>Avisos</h1>
      <nav aria-label="Situação dos avisos" className={estilos.abas}>
        <Link href="/avisos" aria-current={situacao === 'abertos' ? 'page' : undefined}>
          Abertos
        </Link>
        <Link
          href="/avisos?situacao=resolvidos"
          aria-current={situacao === 'resolvidos' ? 'page' : undefined}
        >
          Resolvidos
        </Link>
      </nav>
      {avisos.length === 0 ? (
        <p className={estilos.vazio}>
          {situacao === 'abertos' ? 'Nenhum aviso aberto.' : 'Nenhum aviso resolvido.'}
        </p>
      ) : (
        <ul className={estilos.lista}>
          {avisos.map((a) => (
            <li key={a.id} className={estilos.cartao}>
              <p className={estilos.texto}>{a.texto}</p>
              <p className={estilos.data}>
                {situacao === 'abertos'
                  ? formatarDataHora(a.criadoEm)
                  : `Resolvido em ${formatarDataHora(a.resolvidoEm ?? a.criadoEm)}`}
              </p>
              <div className={estilos.acoes}>
                <Link href={`/onboardings/${a.onboardingId}`} className={estilos.secundario}>
                  Ver onboarding
                </Link>
                {situacao === 'abertos' && <BotaoResolver id={a.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
