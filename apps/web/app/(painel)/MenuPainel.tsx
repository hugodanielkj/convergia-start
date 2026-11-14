'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import estilos from './painel.module.css';

const MENU = [
  { href: '/onboardings', rotulo: 'Onboardings', icone: 'M4 6h16M4 12h16M4 18h10' },
  {
    href: '/clientes',
    rotulo: 'Clientes',
    icone:
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a7 7 0 0 1 14 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9',
  },
  {
    href: '/config',
    rotulo: 'Configurações',
    icone: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  },
] as const;

/**
 * Menu principal (mobile-first): no celular vira uma barra de abas fixa embaixo, ao alcance do
 * polegar e acima da barra de gestos; a partir do tablet fica no topo, ao lado da marca.
 */
export function MenuPainel() {
  const caminho = usePathname();
  return (
    <nav aria-label="Menu principal" className={estilos.navegacao}>
      <ul className={estilos.menu}>
        {MENU.map((item) => {
          const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={estilos.item}
                aria-current={ativo ? 'page' : undefined}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={estilos.icone}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.icone} />
                </svg>
                <span>{item.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
