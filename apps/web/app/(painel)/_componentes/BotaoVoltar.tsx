'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type MouseEvent } from 'react';
import estilos from './voltar.module.css';

// Memória da navegação dentro do painel (some ao recarregar a página, de propósito).
// Não usamos o "voltar" do navegador: ele reaproveita a tela antiga do cache e mostraria dados
// desatualizados (ex.: o acesso recém-confirmado). Navegamos de novo, com dados novos, e
// devolvemos a rolagem que a tela tinha quando o usuário saiu dela.
const historico: string[] = [];
const posicoes = new Map<string, number>();
let restaurar: { caminho: string; y: number } | null = null;

function caminhoAtual(): string {
  return window.location.pathname + window.location.search;
}

/** Fica na casca do painel: anota as telas visitadas e a rolagem de cada uma ao sair dela. */
export function RastreadorNavegacao() {
  const caminho = usePathname();

  useEffect(() => {
    // Captura antes do clique navegar: guarda onde o usuário estava na tela que vai deixar.
    const aoClicar = (evento: globalThis.MouseEvent) => {
      if (evento.target instanceof Element && evento.target.closest('a')) {
        posicoes.set(caminhoAtual(), window.scrollY);
      }
    };
    document.addEventListener('click', aoClicar, true);
    return () => {
      document.removeEventListener('click', aoClicar, true);
    };
  }, []);

  useEffect(() => {
    const atual = caminhoAtual();
    if (historico.at(-1) !== atual) historico.push(atual);
    if (restaurar?.caminho === atual) {
      const { y } = restaurar;
      restaurar = null;
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    }
  }, [caminho]);

  return null;
}

/**
 * Botão "Voltar" do painel. Sem `para`, volta para a tela anterior; com `para`, vai sempre para
 * esse destino. Nos dois casos a tela de destino volta na mesma posição de rolagem. Se a página
 * foi aberta direto (sem tela anterior no painel), vai para `padrao`.
 */
export function BotaoVoltar({
  padrao,
  para,
  ocultarEm,
}: {
  padrao: string;
  para?: string;
  ocultarEm?: string;
}) {
  const router = useRouter();
  const caminho = usePathname();
  if (caminho === ocultarEm) return null;

  function voltar(evento: MouseEvent<HTMLAnchorElement>) {
    // Ctrl/Cmd+clique abre em outra aba normalmente.
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return;
    const destino = para ?? historico.at(-2);
    if (!destino) return;
    evento.preventDefault();
    if (historico.at(-2) === destino) historico.pop();
    restaurar = { caminho: destino, y: posicoes.get(destino) ?? 0 };
    router.push(destino, { scroll: false });
  }

  return (
    <Link href={para ?? padrao} onClick={voltar} className={estilos.voltar}>
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
        <path d="m15 18-6-6 6-6" />
      </svg>
      Voltar
    </Link>
  );
}
