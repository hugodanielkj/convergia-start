---
paths:
  - 'apps/**/*.{ts,tsx}'
  - 'packages/**/*.ts'
---

# Padrões de código

- TypeScript estrito. Proibido `any`, `@ts-ignore` e `as` para silenciar erro; use `unknown` + validação (Zod).
- Domínio em português sem acento (`Onboarding`, `calcularPrazoLiberacao`), como na spec. Termos técnicos consagrados podem ficar em inglês (`handler`, `repository`, `adapter`).
- Funções pequenas, um propósito. Prefira funções puras e dados imutáveis.
- Erros de negócio são tipados (`class RegraVioladaError` com código `RN-xx`), nunca strings soltas.
- Sem valores mágicos: prazos, textos, horários e limites vêm de `ConfigAgencia` ou env (instrução 5 da spec).
- Comentários só para o "porquê" não óbvio, citando a RN quando for regra.
- Sem código morto, sem `console.log` (use o logger).
- Datas: armazenar em UTC; converter para fuso só na borda (D-14).

## Arquitetura (D-10, D-12)

- `packages/core`: regras de negócio puras. **Não importa** Fastify, Prisma, Next ou SDKs externos. Define as interfaces (portas) das integrações.
- `apps/api`: rotas finas → casos de uso → repositórios/adaptadores. Validação de entrada com Zod na rota.
- `apps/web`: só apresentação; regras vêm da API ou de `core`.
- Toda consulta ao banco filtra por `agencia_id` (RN-75).
