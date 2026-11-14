# Fundo creme sempre, menu só com ícones e filtro com cara de botão

- **Data / trilha:** 2026-11-14 / A
- **Decisão (PO):**
  1. **Fundo creme em todas as telas.** O app não tem mais tema escuro: o celular em modo escuro também mostra o creme. Topo e barra de abas do painel também ficam creme, separados por uma linha fina, sem o petrol.
  2. **Menu do painel só com ícones,** sem texto embaixo. Os três ícones (Onboardings = prancheta com ✓, Clientes = pessoas, Configurações = engrenagem) usam o mesmo grid de 24px, o mesmo traço e o mesmo tamanho. O item ativo fica na cor de destaque, dentro de uma pílula laranja clara. O nome continua no `aria-label` e no `title` (regra 7 do mobile-first).
  3. **"Filtros" em `/onboardings` parece botão:** pílula com contorno, ícone de funil e seta que gira ao abrir.
- **Motivo:** o PO achou o visual escuro carregado, os ícones com tamanhos diferentes e o filtro parecido com uma caixa não clicável.
- **Consequências:**
  - `globals.css` não tem mais `@media (prefers-color-scheme: dark)` e define `color-scheme: light`. Não reintroduza o tema escuro sem decisão do PO.
  - Ícones novos no menu: mesmo grid e traço (desenhos do Lucide, licença ISC), sempre com `aria-label`.
  - Tokens novos: `--realce-suave` (fundo do item ativo) e `--hover-suave`.
