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
- `apps/api/prisma/schema/base.prisma`: só PRs de contrato. Cada módulo tem seu próprio `apps/api/prisma/schema/<modulo>.prisma`. Exceção permitida: uma linha de relação reversa em `Agencia`/`Usuario`, no bloco marcado e em ordem alfabética.
- `apps/api/prisma/migrations/`: gere a migração **só na hora de abrir o PR**, depois de `git rebase hml`. Se a `hml` ganhou migração nova, apague a sua, rebase e gere de novo. A CI falha se schema e migrações divergirem.
- `packages/core/src/base/config.ts` + `ConfigAgencia` no schema: já têm os campos de todas as RN do MVP. Campo novo = PR de contrato.
- `.github/`, `eslint.config.mjs`, `tsconfig*.json`, `docker-compose.yml`, `app/globals.css`: alterações em PR `chore/` próprio.

## Para não conflitar no código

- **API:** cada módulo em `apps/api/src/modulos/<modulo>/index.ts` exportando um plugin Fastify; `src/base/modulos.ts` registra todos sozinho. Não há arquivo central de rotas.
- **Banco no módulo:** use `prismaDaRequisicao(app, request)` (escopo da agência, RN-75). O `app.deps.prisma` cru só para seed, testes e rotas públicas do link (que resolvem a agência pelo token).
- **Eventos:** declare os eventos do módulo no próprio arquivo com `declare module '@convergia/core/base' { interface MapaEventos { ... } }` e publique por `app.deps.eventos`. Não edite `eventos.ts`.
- **core:** cada domínio em `packages/core/src/<dominio>/index.ts`, importado por subcaminho (`@convergia/core/prazo`). Não há barrel central.
- **Web:** cada área em sua pasta do App Router; cada etapa do cliente em `app/o/[token]/_etapas/<etapa>/`. A casca da página já importa as 4 etapas. Estilos em `*.module.css` ao lado do componente.

## Documentação

- `backlog.md`: marque só as linhas das suas histórias.
- Arquivo da sprint: edite só a seção da sua trilha.
- Decisões: um arquivo novo por decisão em `.claude/docs/decisoes/AAAA-MM-DD-<trilha>-<slug>.md`. Não edite `decisoes.md` (histórico até D-24).

## Ritmo

- Rebase na `hml` pelo menos uma vez por dia e antes de abrir o PR.
- PRs pequenos (idealmente até ~400 linhas). CI verde → merge (squash) → apague a branch.
- Mudou um contrato que a outra trilha usa? Diga isso ao usuário no relatório final, para ele avisar o colega.
