# Mobile-first obrigatório na interface

- **Data / trilha:** 2026-11-14 / A
- **Decisão:** toda tela de `apps/web` (painel e página do cliente) é desenhada e testada **primeiro no celular**. Uma tela que não funciona a 360px está quebrada, mesmo que funcione no computador. As regras abaixo valem para qualquer PR que toque `apps/web` e são conferidas por testes automáticos na CI.

  1. **CSS do celular primeiro.** O estilo base é o do celular. Telas maiores entram com `@media (min-width: ...)`. É proibido usar `@media (max-width: ...)` para "consertar" o celular.
  2. **Largura de referência: 360px.** Nenhuma tela pode ter rolagem horizontal a 360px (nem a 375px, nem no tablet de 768px).
  3. **Alvos de toque de pelo menos 44×44px:** botões, links que funcionam como botão, campos, seletores e a linha inteira de caixas de seleção (o `label`). Links dentro de um parágrafo de texto são a única exceção.
  4. **Campos com fonte de pelo menos 16px.** Abaixo disso o iPhone dá zoom ao tocar no campo.
  5. **Tabelas viram cartões ou lista no celular.** Colunas só a partir do tablet ou desktop.
  6. **Menu do painel cabe no celular:** nenhum item cortado ou escondido numa rolagem lateral.
  7. **Nada essencial só no hover.** `title` e tooltip podem complementar, mas a informação ou o motivo de um botão desativado também aparece em texto visível ou no nome acessível.
  8. **Áreas seguras.** Topo, rodapé e barras fixas respeitam `env(safe-area-inset-*)` (entalhe e barra de gestos do iPhone).

- **Como verificar:**
  - `pnpm --filter @convergia/web test:e2e`: testes Playwright a 360×800 e 375×812 que falham com rolagem horizontal, alvos de toque menores que 44px ou campos com fonte menor que 16px. Rodam na CI.
  - Antes de abrir o PR, abrir a tela no navegador do app a 360px (skill `implementar-historia`, passo de verificação) e marcar o item no template de PR.
  - Regras detalhadas e checklist: `.claude/rules/ui-mobile.md`.

- **Motivo:** o PO testou no celular depois da Sprint 6 e o app não funcionava bem. O cliente da agência abre o link quase sempre pelo celular (WhatsApp), e a equipe da agência também usa o painel no celular. O `CLAUDE.md` já dizia "mobile-first", mas sem regra verificável isso não foi garantido.

- **Auditoria que motivou a decisão (hml de 2026-11-14, a 360px):**
  - **Todas as telas do painel:** o topo ocupava ~145px (18% da tela) em três linhas; o menu cortava "Configurações" numa rolagem lateral escondida; links do menu com 38px e "Sair" com 36px; "Configurações" levava a `/config`, que dava 404.
  - **`/onboardings`:** tabela de 8 colunas com 772px de largura (progresso, prazo e atenção fora da tela); 7 filtros com fonte de 13,6px (zoom no iPhone) e botão "Filtrar" com 40px; estado dos ícones de progresso só no tooltip.
  - **`/onboardings/[id]`:** botões de ação com 40px; seletor com fonte de 14,4px; links "← Onboardings", "Personalizar perguntas e acessos" e "Confirmar acessos" com 22–24px de altura; dois botões desativados com o motivo só no hover.
  - **`/onboardings/[id]/acessos`:** "Marcar concedido" e "Marcar inválido" com 40px.
  - **`/clientes`:** link "Personalizar" com 18px de altura.
  - **`/clientes/novo`, `/onboardings/[id]/personalizar` e `/config/formulario`:** botões ↑ e ↓ com 37×39px, "Remover"/"Arquivar" com 39px, caixa "Obrigatório" com 24px; motivo do tipo travado só no hover.
  - **`/config/agenda` e `/config/templates`:** caixas dos dias da semana com 24px; botões com 42px.
  - **`/o/[token]`, etapa Formulário:** campos 6px mais largos que a tela (rolagem horizontal). Página sem áreas seguras.
  - **Tablet (768px):** a tabela de onboardings ficava apertada, com o nome do cliente quebrado em três linhas.
  - Sem problemas: `/entrar`, `/o/[token]/expirado`, `/config/acessos` (fora o topo) e as etapas Acessos, Reunião e Captação (bloqueada).

- **Complementa:** `2026-11-14-a-visual-convergia.md` (o item "mobile-first" de lá passa a ter regras e testes).
