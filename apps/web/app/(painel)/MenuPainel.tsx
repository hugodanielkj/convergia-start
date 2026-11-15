'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import estilos from './painel.module.css';

// Ícones no mesmo grid de 24px e mesmo traço, para terem o mesmo peso visual. Desenhos do
// Lucide (licença ISC). Sem texto visível: o nome vai em aria-label e no title.
const MENU: { href: string; rotulo: string; icone: ReactNode }[] = [
  {
    href: '/onboardings',
    rotulo: 'Onboardings',
    icone: (
      <>
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="m9 14 2 2 4-4" />
      </>
    ),
  },
  {
    href: '/clientes',
    rotulo: 'Clientes',
    icone: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    href: '/avisos',
    rotulo: 'Avisos',
    icone: (
      <>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </>
    ),
  },
  {
    href: '/config',
    rotulo: 'Configurações',
    icone: (
      <>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
];

/**
 * Menu principal (mobile-first): no celular vira uma barra de abas fixa embaixo, ao alcance do
 * polegar e acima da barra de gestos; a partir do tablet fica no topo, ao lado da marca.
 * Só ícones (decisão do PO): o item ativo ganha fundo e traço laranja para não depender de texto.
 */
export function MenuPainel({ avisos }: { avisos: number }) {
  const caminho = usePathname();
  return (
    <nav aria-label="Menu principal" className={estilos.navegacao}>
      <ul className={estilos.menu}>
        {MENU.map((item) => {
          const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);
          // RN-58: o número de avisos abertos aparece no ícone e no nome lido pelo leitor de tela.
          const contador = item.href === '/avisos' && avisos > 0 ? avisos : 0;
          const rotulo =
            contador > 0 ? `${item.rotulo} (${String(contador)} abertos)` : item.rotulo;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={estilos.item}
                aria-label={rotulo}
                title={rotulo}
                aria-current={ativo ? 'page' : undefined}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={estilos.icone}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {item.icone}
                </svg>
                {contador > 0 && (
                  <span className={estilos.contador} aria-hidden="true">
                    {contador > 99 ? '99+' : contador}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
