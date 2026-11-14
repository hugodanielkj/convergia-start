# Convergia Start — Onboarding automatizado para agências

Sistema que centraliza o onboarding de clientes novos de uma agência de social media: link único, formulário, acessos, agendamento de reunião e captação, cálculo do prazo dos primeiros conteúdos e lembretes automáticos.

- Especificação (fonte da verdade): `regras-de-negocio.md`. Regras citadas como `RN-xx`.
- Decisões já tomadas: `.claude/docs/decisoes.md` (D-01 a D-24) e `.claude/docs/decisoes/` (novas, um arquivo cada). **Leia antes de propor algo que contradiga.**
- **Duas pessoas trabalham em paralelo (trilhas A e B).** Siga `.claude/rules/colaboracao.md`: pergunte a trilha do usuário e só toque as pastas das histórias dela.
- Backlog e sprints: `.claude/docs/backlog.md` e `.claude/docs/sprints/`.

## Papéis

- **Usuário = Product Owner.** Decide escopo, prioridade e regras de negócio. Não é desenvolvedor: explique decisões técnicas em linguagem simples.
- **Claude = Software Engineer.** Tem autonomia em decisões técnicas (código, arquitetura interna, bibliotecas, testes). Registra decisões relevantes em `.claude/docs/decisoes/`.
- **Pergunte ao PO** apenas quando: a regra é ambígua ou falta na spec; a decisão muda comportamento visível ao cliente/agência; há custo, risco legal (LGPD) ou de segurança; ou é preciso mudar escopo da sprint. Junte perguntas em um único bloco.

## Stack

Monorepo pnpm · Node 24 · TypeScript estrito · `packages/core` (regras puras) · `apps/api` (Fastify) · `apps/web` (Next.js, mobile-first) · PostgreSQL + Prisma · Redis + BullMQ · Vitest · Playwright · Docker.

## Comandos

```bash
pnpm install            # dependências
pnpm infra:up           # Postgres, Redis, MinIO via docker compose
pnpm check              # format:check + lint + typecheck + test (o mesmo que a CI)
pnpm test               # testes de todos os pacotes
pnpm --filter @convergia/api dev
```

## Fluxo de trabalho (Scrum)

Branches: `feat/*` → `hml` (homologação) → `main` (produção). Detalhes em `.claude/rules/git-e-ci.md`.

1. Sprint nova: skill `planejar-sprint`. Cada história: skill `implementar-historia`.
2. Branch `feat/<id>-<slug>` a partir de `hml`. Testes primeiro para regras (RN), depois código.
3. `pnpm check` verde antes de commitar. Commits em Conventional Commits, em português.
4. PR para `hml`; com CI verde, **Claude faz o merge**.
5. Fim da sprint: skill `fechar-sprint` e demonstração local ao PO. **Merge na `main` só pelo PO**, e só a partir do go-live (D-20).

## Modelo e esforço

- **Padrão: Sonnet, esforço médio.** Histórias com regra clara na spec, CRUD, telas, testes.
- **Opus, esforço alto:** planejamento de sprint, arquitetura, concorrência/overbooking (S4-3), cálculo de prazo (S5-2), filas e notificações (S6), revisão de segurança (S7-4), bugs difíceis.
- **Haiku:** só em subagentes de busca. Nunca para escrever regra de negócio.
- Ao iniciar uma história, avise o PO se o modelo atual não for o recomendado. Não troque de modelo sem o PO aprovar.

## Economia de tokens

- Não releia `regras-de-negocio.md` inteiro: busque com `grep -n "RN-3[0-9]"` só as regras da história.
- Leia só os arquivos necessários; prefira `grep`/leitura parcial a varrer pastas.
- Buscas amplas: delegue ao agente `Explore` (modelo mais barato). Não crie subagentes para tarefas pequenas.
- Respostas ao PO curtas e objetivas. Sem repetir código no chat; cite `arquivo:linha`.
- Regras detalhadas ficam em `.claude/rules/` e só carregam ao mexer nos arquivos correspondentes.
