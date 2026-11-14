# Sprint 0 — Fundação

**Objetivo:** base do projeto pronta para desenvolver com segurança: padrões, testes, Docker e CI.

## Entregue

- `.claude/` com CLAUDE.md, regras, skills, decisões e backlog.
- Monorepo pnpm com `packages/core`, `apps/api` (healthcheck) e `apps/web` (página inicial).
- Prettier, ESLint (typed), TypeScript estrito, Vitest com cobertura mínima.
- `docker-compose.yml` (Postgres, Redis, MinIO) e Dockerfiles de produção para api e web.
- CI no GitHub Actions: formatação, lint, typecheck, testes, build, auditoria de dependências e build das imagens Docker. Dependabot semanal.

## Pendente com o PO

- Conectar o repositório ao GitHub e ativar proteção da branch `main` (exigir CI verde e PR).

## Retro

- (preencher ao fechar)
