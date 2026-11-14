import Link from 'next/link';
import type { ReactNode } from 'react';
import estilos from './painel.module.css';

// Casca do painel da agência (S1-1). Cada área cria sua pasta em app/(painel)/<area>.
const MENU = [
  { href: '/onboardings', rotulo: 'Onboardings' },
  { href: '/clientes', rotulo: 'Clientes' },
  { href: '/config', rotulo: 'Configurações' },
];

export default function LayoutPainel({ children }: { children: ReactNode }) {
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
      </header>
      <main className={estilos.conteudo}>{children}</main>
    </div>
  );
}
