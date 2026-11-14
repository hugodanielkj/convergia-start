# Visual Convergia e progresso por ícones (S6-1, S6-5, S6-6)

- **Data / trilha:** 2026-11-14 / A
- **Decisão:**
  - **Tokens** do site convergiadigital.com em `globals.css`: `--cream`, `--orange`, `--orange-text`, `--peach`, `--petrol`, `--ink`, `--muted` e `--line`. Os tokens antigos (`--cor-*`) passam a apontar para eles, para as telas não quebrarem. O modo escuro usa fundo `--ink`/`--petrol` e texto `--cream`.
  - **Fontes:** títulos em Fraunces (peso 500), carregada por `next/font/google`. O arquivo é baixado no build e servido pelo próprio app, sem chamada ao Google no navegador (LGPD). O texto usa Arial/Helvetica, como o site.
  - **Contraste (WCAG AA):** texto laranja usa `--orange-text`. O `--orange` fica para superfícies grandes, ícones e foco. Botões principais usam fundo `--orange-text` com texto `--cream`.
  - **Progresso no painel:** 4 ícones, na ordem Formulário, Acessos, Reunião e Captação:
    - verde com ✓: concluída;
    - laranja: em andamento;
    - cinza: pendente;
    - cadeado: bloqueada, pela regra de liberação.

    Cada ícone tem nome acessível ("Acessos: em andamento") e tooltip. O estado não depende só da cor.

  - **Estilo:** mobile-first e minimalista: menos texto, cantos arredondados como no site e uma ação principal por tela.
- **Motivo:** pedido do PO depois da conversa com o primeiro cliente. A marca da agência deve aparecer em tudo.
