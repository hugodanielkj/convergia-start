import Link from 'next/link';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { exigirSessao } from '../_lib/sessao';
import { URL_API } from '../_lib/url-api';
import { RastreadorNavegacao } from './_componentes/BotaoVoltar';
import { MenuPainel } from './MenuPainel';
import estilos from './painel.module.css';

// Casca do painel da agência. Cada área cria sua pasta em app/(painel)/<area>.

/**
 * Exige login para todo o painel (S1-2). É uma conveniência de navegação: quem protege
 * os dados de verdade é a API, que confere a sessão em cada requisição.
 */
/** Avisos abertos para o contador do menu (RN-58). Falhar aqui não pode derrubar o painel. */
async function avisosAbertos(): Promise<number> {
  try {
    const r = await fetch(`${URL_API}/alertas/contagem`, {
      headers: { cookie: (await cookies()).toString() },
      cache: 'no-store',
    });
    if (!r.ok) return 0;
    const { abertos } = (await r.json()) as { abertos: number };
    return abertos;
  } catch {
    return 0;
  }
}

export default async function LayoutPainel({ children }: { children: ReactNode }) {
  const usuario = await exigirSessao();
  const avisos = await avisosAbertos();

  return (
    <div className={estilos.painel}>
      <header className={estilos.topo}>
        <Link href="/onboardings" className={estilos.marca}>
          Convergia Start
        </Link>
        <MenuPainel avisos={avisos} />
        <form action="/api/auth/sair" method="post" className={estilos.conta}>
          <span className={estilos.usuario}>{usuario.nome}</span>
          <button type="submit" className={estilos.sair}>
            Sair
          </button>
        </form>
      </header>
      <RastreadorNavegacao />
      <main className={estilos.conteudo}>{children}</main>
    </div>
  );
}
