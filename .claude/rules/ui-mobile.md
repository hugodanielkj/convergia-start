---
paths:
  - 'apps/web/**'
---

# UI mobile-first (obrigatório)

> **Uma tela que não funciona a 360px está quebrada.** Decisão: `.claude/docs/decisoes/2026-11-14-a-mobile-first.md`. Os testes `pnpm --filter @convergia/web test:e2e` reprovam a CI quando estas regras são violadas.

## Como escrever o CSS

- Estilo base = celular. Telas maiores com `@media (min-width: 40rem)` (≈640px) e `@media (min-width: 64rem)` (≈1024px). **Nunca** `@media (max-width: ...)`.
- Larguras fluidas: `width: 100%`, `max-width`, `minmax(0, 1fr)`, `flex-wrap: wrap`. Nada de `width` fixo em px maior que 320px. Texto longo (e-mail, link, token) com `overflow-wrap: anywhere`.
- Use os tokens de `globals.css` (`--fundo`, `--superficie`, `--destaque`, `--raio`, `--alvo-toque`, `--gutter`...). Sem cores ou tamanhos soltos.
- Fundo sempre creme, sem tema escuro. Ícone sem texto visível exige `aria-label` (decisão `2026-11-14-a-fundo-creme-menu-icones.md`).
- `globals.css` já garante: campos com 16px e 44px de altura, `box-sizing: border-box` e botões com 44px. Não reduza isso no `*.module.css`.

## Checklist (marque no PR)

- [ ] Abri a tela no navegador do app a **360×800** e a **375×812**, e depois a 768px e no desktop.
- [ ] Sem rolagem horizontal (`document.documentElement.scrollWidth` igual à largura da tela).
- [ ] Alvos de toque ≥ **44×44px**: botões, links com cara de botão, campos, seletores e a linha inteira de checkbox/radio (`label`). Exceção: link dentro de parágrafo.
- [ ] Campos (`input`, `select`, `textarea`) com fonte ≥ **16px**.
- [ ] Tabela vira cartão ou lista no celular; colunas só com `min-width`.
- [ ] Menu e barras de ação cabem a 360px, sem item cortado.
- [ ] Nada essencial só no hover: motivo de botão desativado e estado de ícone também em texto visível ou `aria-label`.
- [ ] Barras e elementos fixos respeitam `env(safe-area-inset-*)`.
- [ ] Uma ação principal por tela, larga e fácil de alcançar com o polegar.

## Testes

- Tela nova ou rota nova: inclua-a em `apps/web/e2e/telas.ts` para entrar na verificação de celular.
- Rode `pnpm --filter @convergia/web test:e2e` antes do PR quando mexer em CSS ou estrutura (veja o README em `apps/web/e2e/`).
