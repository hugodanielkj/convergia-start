# Base compartilhada (S1-1)

- **Data / trilha:** 2026-11-13 / A
- **Decisão:**
  - Prisma 7.10 (cliente `prisma-client`, driver `@prisma/adapter-pg`), schema em pasta `apps/api/prisma/schema/`, cliente gerado em `apps/api/src/generated` (não versionado, gerado no `postinstall`).
  - RN-75 aplicada por extensão do Prisma (`escopoAgencia`): toda operação ganha `agenciaId` no filtro/dados; só `Agencia` é global; operação desconhecida falha em vez de passar sem escopo.
  - Módulos carregados por `src/base/modulos.ts` (carregador próprio), não por `@fastify/autoload`, que importa por fora do Vitest e quebra os testes.
  - Contrato de login: `ResolvedorSessao` em `src/base/auth.ts`. Até a S1-2, `AUTH_DEV_USUARIO_EMAIL` autentica como um usuário do seed em desenvolvimento (proibido em produção pelo `carregarEnv`).
  - Eventos de domínio por declaration merging de `MapaEventos`; barramento em memória que isola falhas de assinantes.
  - Testes de integração (`*.int.test.ts`) criam as próprias agências: não limpam o banco e rodam em paralelo. `pnpm test` roda só unitários; a CI roda tudo com Postgres e confere se migrações batem com o schema.
  - Postgres local na porta 55432 (a 5432/5433 costumam estar ocupadas). MinIO removido: a imagem saiu do Docker Hub; storage será escolhido na S2-4.
- **Motivo:** permitir que as duas trilhas criem módulos, tabelas e eventos sem editar arquivos centrais (D-24), com isolamento de agência garantido por padrão.
