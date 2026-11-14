---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.spec.ts'
  - '**/e2e/**'
---

# Testes

- Toda regra de negócio tem teste citando o ID: `describe('RN-43 prazo de liberação', ...)`.
- Unitários junto do código (`arquivo.test.ts`). Integração com banco em `*.int.test.ts`. E2E em `apps/web/e2e/` (Playwright; telas no celular, veja `.claude/rules/ui-mobile.md`).
- Escreva o teste da regra antes da implementação. Cubra caminho feliz, limites e erro.
- Testes determinísticos: injete relógio (`agora: Date`) e gerador de token; nunca dependa da data real ou de rede.
- Integrações externas são substituídas por fakes que implementam a mesma interface de `core`.
- Cobertura mínima: `core` 90%, `api` 80%. Não escreva testes vazios só para cobertura.
- Nomes de teste descrevem o comportamento em português: `it('não exibe slots com menos de 24h de antecedência')`.
- Testes de integração rodam em paralelo no mesmo banco: cada teste cria a própria agência e só confere os dados dela. Nunca dependa de "todos os registros" do banco.
