# Git, PR e CI (D-19, D-20)

> **Fase atual: desenvolvimento (D-20).** `hml` funciona como branch principal. Não abra PR `hml → main` ao fechar sprint; isso só acontece no go-live, a pedido do PO. Homologação = rodar localmente e mostrar ao PO no navegador do app.

## Branches

- `main`: produção. **Merge só com aprovação do PO.** Nunca commitar nem dar push direto.
- `hml`: homologação, onde o PO testa. Claude pode fazer merge com CI verde. Sem commits diretos.
- Trabalho: `feat/S1-3-cadastro-cliente`, `fix/<slug>`, `chore/<slug>`, sempre criadas a partir de `hml`.

## Fluxo

1. `git switch hml && git pull && git switch -c feat/<ID>-<slug>`.
2. Commits em Conventional Commits, em português: `feat(api): cadastro de cliente (RN-04, RN-05)`.
3. `pnpm check` antes de commitar. O pre-commit roda Prettier e ESLint nos arquivos alterados.
4. PR `feat/* → hml` com o template. CI verde → Claude faz merge (squash) e apaga a branch.
5. Ao fim da sprint (ou quando o PO pedir): PR `hml → main` com o resumo do que entra. Claude **não** faz esse merge; o PO aprova e faz o merge.
6. Se `main` receber hotfix, trazer de volta para `hml` (`main → hml`).

## Regras

- Nunca `push --force` em `main` ou `hml`. Nunca desativar teste ou regra de lint para a CI passar.
- Um PR por história. Migrações Prisma versionadas; nunca editar migração já mergeada em `hml`.
- Dependência nova: justificar no PR (manutenção ativa, licença, tamanho).
