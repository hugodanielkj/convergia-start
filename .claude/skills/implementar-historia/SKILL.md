---
name: implementar-historia
description: Fluxo para implementar uma história do backlog (ex. "S1-3") de ponta a ponta — branch, testes das RN, código, validação e PR. Use ao começar qualquer história.
---

# Implementar história

Argumento: ID da história (ex. `S1-3`).

1. **Contexto mínimo.** Leia a linha da história em `.claude/docs/backlog.md`. Busque só as RN citadas: `grep -n -A3 "RN-04\|RN-05" regras-de-negocio.md`. Confira `decisoes.md` e `decisoes/` se a história tocar algo decidido. Confirme que a história é da trilha do usuário e anote as **Pastas** permitidas (`.claude/rules/colaboracao.md`).
2. **Dúvidas.** Se uma regra estiver ambígua ou faltar dado, pare e pergunte ao PO em um único bloco, com sua recomendação. Senão, siga.
3. **Branch.** `git switch hml && git pull && git switch -c feat/<ID>-<slug>`. Marque `[~]` no backlog.
4. **Testes primeiro.** Escreva os testes de cada RN (veja `.claude/rules/testes.md`). Rode e confirme que falham.
5. **Implementação.** Mínimo para passar, seguindo `.claude/rules/codigo.md`. Refatore com os testes verdes.
6. **Validação.** `pnpm check`. Se mexeu em Docker ou build, `docker compose build`.
7. **Commit e PR.** Commits em Conventional Commits. Push e `gh pr create --base hml` com o template preenchido. Aguarde a CI.
8. **Merge em hml.** Com CI verde: `gh pr merge --squash --delete-branch`. Antes do merge, `git rebase hml` (regere a migração se a `hml` ganhou outra). Marque `[x]` no backlog e registre decisões novas como arquivo em `.claude/docs/decisoes/`. Corrija a CI se quebrar; nunca faça merge com CI vermelha.
9. **Homologação.** Rode o app localmente e mostre ao PO no navegador do app o que mudou (D-20). Merge em `main` só no go-live, aprovado pelo PO.

Relate ao PO em até 5 linhas: o que mudou, como testar, decisões tomadas, pendências.
