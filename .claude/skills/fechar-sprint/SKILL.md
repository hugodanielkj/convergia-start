---
name: fechar-sprint
description: Review e retrospectiva de sprint — resume o que foi entregue, o que ficou pendente e lições. Use quando todas as histórias da sprint estiverem mergeadas ou o PO pedir para fechar.
---

# Fechar sprint

1. Liste PRs mergeados em `hml` na sprint: `gh pr list --base hml --state merged --limit 20`. Abra o PR `hml → main` com o resumo e peça a aprovação do PO (não faça o merge).
2. Atualize o arquivo da sprint em `.claude/docs/sprints/`:
   - **Entregue:** histórias concluídas, em linguagem de produto.
   - **Não entregue:** o que voltou ao backlog e por quê.
   - **Retro:** até 3 itens "manter", 3 "melhorar". Se algo virou regra, atualize `.claude/rules/` ou `CLAUDE.md`.
3. Atualize os status no `backlog.md`.
4. Apresente ao PO um resumo de até 8 linhas e o que demonstrar (como testar no navegador).
