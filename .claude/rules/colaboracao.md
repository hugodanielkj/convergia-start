# Colaboração em duas trilhas (D-24)

Duas pessoas, cada uma com sua sessão do Claude, trabalham em paralelo na `hml`. Objetivo: PRs que não se cruzam.

## Antes de começar

- Pergunte ao usuário qual trilha ele faz (A ou B), se ainda não estiver claro na conversa. Trabalhe só nas histórias dessa trilha.
- `git switch hml && git pull` antes de criar a branch. Uma branch e um PR por história.

## Posse de pastas

- Cada história do `backlog.md` lista as **Pastas** que pode tocar. Não altere pastas da outra trilha.
- Precisa de algo da outra trilha? Use o contrato (interface em `core`, evento ou função exportada). Se o contrato não existir, abra um PR pequeno só com ele, faça merge rápido e avise o usuário para combinar com o colega.

## Arquivos compartilhados (pontos de conflito)

Mudanças nestes arquivos vão em commits pequenos e isolados, e o PR entra na `hml` no mesmo dia:

- `package.json` e `pnpm-lock.yaml`: nunca resolva conflito do lockfile à mão. Pegue a versão da `hml` (`git checkout --theirs pnpm-lock.yaml` durante o rebase) e rode `pnpm install`.
- `prisma/schema/base.prisma`: só a S1-1 e PRs de contrato. Cada módulo tem seu próprio `prisma/schema/<modulo>.prisma`.
- `prisma/migrations/`: gere a migração **só na hora de abrir o PR**, depois de `git rebase hml`. Se a `hml` ganhou migração nova, apague a sua, rebase e gere de novo.
- `.github/`, `eslint.config.mjs`, `tsconfig*.json`, `docker-compose.yml`: alterações em PR `chore/` próprio.

## Para não conflitar no código

- **API:** cada módulo em `apps/api/src/modulos/<modulo>/` e registrado por autoload. Não há arquivo central de rotas para editar.
- **core:** cada domínio em `packages/core/src/<dominio>/`, importado por subcaminho (`@convergia/core/prazo`). Não há barrel central.
- **Web:** cada área em sua pasta do App Router; cada etapa do cliente em `app/o/[token]/_etapas/<etapa>/`. A casca da página (S1-1) já importa as 4 etapas.

## Documentação

- `backlog.md`: marque só as linhas das suas histórias.
- Arquivo da sprint: edite só a seção da sua trilha.
- Decisões: um arquivo novo por decisão em `.claude/docs/decisoes/AAAA-MM-DD-<trilha>-<slug>.md`. Não edite `decisoes.md` (histórico até D-24).

## Ritmo

- Rebase na `hml` pelo menos uma vez por dia e antes de abrir o PR.
- PRs pequenos (idealmente até ~400 linhas). CI verde → merge (squash) → apague a branch.
- Mudou um contrato que a outra trilha usa? Diga isso ao usuário no relatório final, para ele avisar o colega.
