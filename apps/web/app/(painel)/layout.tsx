import Link from 'next/link';
import type { ReactNode } from 'react';
import { exigirSessao } from '../_lib/sessao';
import estilos from './painel.module.css';

// Casca do painel da agência. Cada área cria sua pasta em app/(painel)/<area>.
const MENU = [
  { href: '/onboardings', rotulo: 'Onboardings' },
  { href: '/clientes', rotulo: 'Clientes' },
  { href: '/config', rotulo: 'Configurações' },
];

/**
 * Exige login para todo o painel (S1-2). É uma conveniência de navegação: quem protege
 * os dados de verdade é a API, que confere a sessão em cada requisição.
 */
export default async function LayoutPainel({ children }: { children: ReactNode }) {
  const usuario = await exigirSessao();

  return (
    <div className={estilos.painel}>
      <header className={estilos.topo}>
        <Link href="/" className={estilos.marca}>
          Convergia Start
        </Link>
        <nav aria-label="Menu principal">
          <ul className={estilos.menu}>
            {MENU.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.rotulo}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action="/api/auth/sair" method="post" className={estilos.conta}>
          <span>{usuario.nome}</span>
          <button type="submit" className={estilos.sair}>
            Sair
          </button>
        </form>
      </header>
      <main className={estilos.conteudo}>{children}</main>
    </div>
  );
}
