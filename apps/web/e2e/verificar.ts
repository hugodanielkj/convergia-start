import { expect, type Page } from '@playwright/test';

// Verificações da decisão mobile-first (.claude/docs/decisoes/2026-11-14-a-mobile-first.md).
// Rodam dentro do navegador e devolvem uma lista legível do que está fora da regra.

export const ALVO_MINIMO = 44;
export const FONTE_MINIMA_CAMPO = 16;

interface Problemas {
  rolagem: string[];
  alvos: string[];
  fontes: string[];
  soNoHover: string[];
}

/** Coleta os problemas da tela visível. Função auto-contida: roda no navegador. */
function coletar({ alvoMinimo, fonteMinima }: { alvoMinimo: number; fonteMinima: number }) {
  const largura = document.documentElement.clientWidth;
  const descrever = (el: Element): string => {
    const texto =
      el.getAttribute('aria-label') ?? (el instanceof HTMLElement ? el.innerText : el.textContent);
    const classe = (el.getAttribute('class') ?? '').split('__')[1] ?? '';
    return `<${el.tagName.toLowerCase()}${classe ? `.${classe}` : ''}> "${texto.trim().slice(0, 30)}"`;
  };
  const visivel = (el: Element): DOMRect | null => {
    const caixa = el.getBoundingClientRect();
    if (caixa.width === 0 || caixa.height === 0) return null;
    return getComputedStyle(el).visibility === 'hidden' ? null : caixa;
  };

  const rolagem: string[] = [];
  if (document.documentElement.scrollWidth > largura) {
    rolagem.push(`página com ${String(document.documentElement.scrollWidth)}px`);
    for (const el of document.body.querySelectorAll('*')) {
      const caixa = visivel(el);
      const pai = el.parentElement?.getBoundingClientRect();
      if (caixa && caixa.right > largura + 0.5 && (!pai || pai.right <= largura + 0.5)) {
        rolagem.push(`${descrever(el)} vai até ${String(Math.round(caixa.right))}px`);
      }
    }
  }

  // Rolagem lateral escondida dentro de um bloco (tabela larga, menu cortado) também conta.
  for (const el of document.body.querySelectorAll('*')) {
    const overflow = getComputedStyle(el).overflowX;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
      rolagem.push(
        `${descrever(el)} rola para o lado (${String(el.scrollWidth)}px em ${String(el.clientWidth)}px)`,
      );
    }
  }

  const alvos: string[] = [];
  const fontes: string[] = [];
  const seletor = 'a, button, input, select, textarea, summary, [role="button"]';
  for (const el of document.querySelectorAll(seletor)) {
    const caixa = visivel(el);
    if (!caixa) continue;
    const estilo = getComputedStyle(el);
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      // A área de toque é a linha inteira (o label), não o quadradinho.
      const rotulo = el.closest('label')?.getBoundingClientRect();
      if (!rotulo || rotulo.height < alvoMinimo) {
        alvos.push(
          `${descrever(el.closest('label') ?? el)} com ${String(Math.round(rotulo?.height ?? caixa.height))}px de altura`,
        );
      }
      continue;
    }
    // Link dentro de um parágrafo de texto é a única exceção (WCAG 2.5.8).
    const linkNoTexto = el.tagName === 'A' && estilo.display === 'inline';
    if (!linkNoTexto && (caixa.height < alvoMinimo - 0.5 || caixa.width < alvoMinimo - 0.5)) {
      alvos.push(
        `${descrever(el)} com ${String(Math.round(caixa.width))}×${String(Math.round(caixa.height))}px`,
      );
    }
    if (el.matches('input, select, textarea') && parseFloat(estilo.fontSize) < fonteMinima) {
      fontes.push(`${descrever(el)} com fonte de ${estilo.fontSize}`);
    }
  }

  // Motivo de botão desativado não pode ficar só no title (hover não existe no celular).
  const soNoHover = [...document.querySelectorAll('button[disabled][title]')]
    .filter((el) => !el.hasAttribute('aria-describedby'))
    .map(descrever);

  return { rolagem, alvos, fontes, soNoHover };
}

export async function problemasDaTela(page: Page): Promise<Problemas> {
  return page.evaluate(coletar, { alvoMinimo: ALVO_MINIMO, fonteMinima: FONTE_MINIMA_CAMPO });
}

/** Falha o teste com a lista do que está fora da regra mobile-first. */
export async function esperarTelaMobileFirst(page: Page): Promise<void> {
  const p = await problemasDaTela(page);
  expect.soft(p.rolagem, 'sem rolagem horizontal').toEqual([]);
  expect.soft(p.alvos, `alvos de toque com pelo menos ${String(ALVO_MINIMO)}px`).toEqual([]);
  expect
    .soft(p.fontes, `campos com fonte de pelo menos ${String(FONTE_MINIMA_CAMPO)}px`)
    .toEqual([]);
  expect.soft(p.soNoHover, 'motivo de botão desativado visível, não só no hover').toEqual([]);
}
