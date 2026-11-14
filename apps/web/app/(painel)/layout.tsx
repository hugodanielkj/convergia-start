import Link from 'next/link';
import type { ReactNode } from 'react';
import { exigirSessao } from '../_lib/sessao';
import { MenuPainel } from './MenuPainel';
import estilos from './painel.module.css';

// Casca do painel da agência. Cada área cria sua pasta em app/(painel)/<area>.

/**
 * Exige login para todo o painel (S1-2). É uma conveniência de navegação: quem protege
 * os dados de verdade é a API, que confere a sessão em cada requisição.
 */
export default async function LayoutPainel({ children }: { children: ReactNode }) {
  const usuario = await exigirSessao();

  return (
    <div className={estilos.painel}>
      <header className={estilos.topo}>
        <Link href="/onboardings" className={estilos.marca}>
          Convergia Start
        </Link>
        <MenuPainel />
        <form action="/api/auth/sair" method="post" className={estilos.conta}>
          <span className={estilos.usuario}>{usuario.nome}</span>
          <button type="submit" className={estilos.sair}>
            Sair
          </button>
        </form>
      </header>
      <main className={estilos.conteudo}>{children}</main>
    </div>
  );
}
