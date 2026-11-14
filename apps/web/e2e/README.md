# Testes de celular (Playwright)

Garantem a decisão **mobile-first** (`.claude/docs/decisoes/2026-11-14-a-mobile-first.md`): cada tela do painel e da página do cliente é aberta a **360×800**, **375×812** e **768×1024** e o teste falha quando há:

- rolagem horizontal na página ou escondida dentro de um bloco (tabela larga, menu cortado);
- alvo de toque menor que 44×44px (botão, link com cara de botão, campo, `summary`, linha de checkbox/radio);
- campo com fonte menor que 16px (zoom do iPhone);
- botão desativado que explica o motivo só no `title` (hover).

## Rodar

```bash
pnpm infra:up                               # Postgres
pnpm --filter @convergia/web test:e2e       # sobe API (3334) e web (3100) sozinho
pnpm --filter @convergia/web test:e2e --project=celular-360   # só uma largura
```

Não precisa parar o `pnpm dev`: os testes usam portas e pasta de build próprias (`.next/e2e`). A API de teste entra com o login de desenvolvimento (`e2e@convergia.test`, criado pelo seed) e o `preparar.ts` cria ou reaproveita dois clientes de teste: "E2E Celular" (termo aceito) e "E2E Termo" (sem termo).

## Tela nova

Inclua a rota em `telas.ts`. Se a tela tem partes recolhidas, passe `abrir` para mostrá-las antes da verificação.

## Fotos (antes e depois)

```bash
E2E_CAPTURAS=depois pnpm --filter @convergia/web test:e2e capturas --project=celular-360
```

As fotos vão para `e2e/capturas/<pasta>/` (fora do git).
