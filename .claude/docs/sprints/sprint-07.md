# Sprint 7 — Endurecimento

**Status:** trilha A em andamento (2026-11-14).

## Trilha A — PO

**Objetivo:** o link público fica protegido contra abuso (tentativas em massa, páginas embutidas, envios forjados) e, depois do encerramento, o cliente vê só um resumo do que foi feito.

**Ordem:** S7-1 → S7-2. As duas não dependem uma da outra; a S7-1 vem antes por ser segurança.

| ID   | História                        | Critérios de aceite                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Modelo / esforço |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| S7-1 | Proteções do link público       | **Limite de requisições (RN-76)** nas rotas `/publico/*`: por IP, por token e um bloqueio temporário do IP que erra muitos tokens (404). Responde 429 com `Retry-After`, sem revelar se o token existe. Valores por variável de ambiente, com padrão. O IP real vem do proxy confiável (`X-Forwarded-For`), e a web repassa o IP do cliente nas chamadas que faz do servidor. **Cabeçalhos de segurança** na API (CSP fechada, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS em produção) e na web (CSP com nonce, `X-Frame-Options`, HSTS em produção). **CSRF:** toda mutação vinda do navegador precisa ser da mesma origem (`Origin`/`Sec-Fetch-Site`), senão 403. Revisão de segurança das rotas públicas e da sessão no fim. | Opus / alto      |
| S7-2 | Tela de resumo após a conclusão | Com o onboarding `concluido` (RN-52), o link abre só `/o/[token]/resumo` (RN-14): as 4 etapas com ✓ e data (formulário enviado, acessos concedidos, reunião, captação), a data de entrega do primeiro conteúdo e a data do encerramento. Sem respostas do formulário nem arquivos. Vale mesmo com o link vencido, sem o botão de pedir novo link. O servidor recusa qualquer alteração pelo link de um onboarding concluído (422 `RN-14`). Mobile-first, conferida a 360px e incluída em `e2e/telas.ts`.                                                                                                                                                                                                                                   | Sonnet / médio   |

## Decisões (trilha A)

- Limite em memória por instância, IP pelo proxy confiável, CSRF por origem e CSP com nonce: `decisoes/2026-11-14-a-protecoes-link-publico.md`.
- Resumo só com etapas e datas, valendo mesmo com link vencido (respostas do PO): `decisoes/2026-11-14-a-resumo-concluido.md`.

## Entregue

### Trilha A

(vazio)

## Retro

### Trilha A

(vazio)

## Trilha B — colaborador

(a preencher pelo colaborador: S7-3 e S7-4)
