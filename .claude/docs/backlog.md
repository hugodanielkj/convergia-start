# Product Backlog

Status: `[ ]` a fazer · `[~]` em andamento · `[x]` pronto (merge em `hml`).
Ordem = prioridade. O PO pode reordenar. Cada história cita as RN que cobre.

## Trabalho em duas trilhas (D-24)

Cada sprint tem duas trilhas que avançam em paralelo, cada uma dona de módulos diferentes, para os PRs não se cruzarem. Regras em `.claude/rules/colaboracao.md`.

- **Trilha A — PO:** experiência do cliente, formulário, acessos, painel, estados, envio de mensagens.
- **Trilha B — colaborador:** cadastro e link, agenda, calendário, captação, prazo, lembretes.

A coluna **Pastas** diz o que a história pode criar ou alterar. Fora delas, só com um PR pequeno e separado (ver regra).

## Definition of Done

- Critérios de aceite atendidos e testes automatizados citando as RN.
- `pnpm check` e CI verdes; sem `any`, sem `TODO` sem história associada.
- Nenhum valor de prazo/texto/horário fixo no código (vem de configuração).
- Só alterou as pastas da sua história (ou abriu PR separado para arquivo compartilhado).
- Decisão nova registrada em `.claude/docs/decisoes/` (um arquivo por decisão).

## Sprint 0 — Fundação técnica

- [x] S0-1 Estrutura `.claude/`, monorepo, lint, testes, Docker e CI.

## Sprint 1 — Base compartilhada, login e cadastro

**S1-1 bloqueia todo o resto:** só depois do merge dela as duas trilhas começam.

| Trilha | História                                                                                                                                                                                                                        | Pastas                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A      | [x] **S1-1 Base compartilhada:** schema base (agência, usuário, config, auditoria), seed, Postgres na CI, esqueleto dos módulos, contratos de auth, eventos e mensageria, cascas do painel e da página do cliente (RN-75, D-01) | `prisma/`, `packages/core/src/base`, `apps/api/src/base`, `apps/web/app/` |
| A      | [x] S1-2 Login com Google e papéis admin/membro (RN-02, RN-03, D-21, D-22)                                                                                                                                                      | `modulos/auth`, `app/(auth)`                                              |
| B      | [~] S1-3 Cadastro de cliente com validação e alerta de duplicidade (RN-04, RN-05, RN-07, RN-08)                                                                                                                                 | `modulos/clientes`, `app/(painel)/clientes`                               |
| B      | [ ] S1-4 Criação automática do onboarding com 4 etapas (RN-06)                                                                                                                                                                  | `modulos/onboarding`                                                      |
| B      | [ ] S1-5 Link único: geração, expiração, regeneração, isolamento (RN-10 a RN-13)                                                                                                                                                | `modulos/link`, `app/o/[token]/expirado`                                  |

## Sprint 2 — Formulário do cliente · Disponibilidade e slots

| Trilha | História                                                                                                                            | Pastas                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A      | [ ] S2-1 Página do cliente: boas-vindas, consentimento LGPD, progresso (RN-50, RN-72)                                               | `app/o/[token]` (exceto `_etapas/reuniao`, `_etapas/captacao`), `modulos/consentimento` |
| A      | [x] S2-2 Modelo de formulário versionado e editável (RN-15, RN-16, RN-19)                                                           | `modulos/formulario`, `app/(painel)/config/formulario`                                  |
| A      | [ ] S2-3 Preenchimento com rascunho automático e conclusão (RN-17, RN-18, RN-21)                                                    | `modulos/formulario`, `_etapas/formulario`                                              |
| A      | [ ] S2-4 Upload de arquivos com validação no servidor (RN-20); escolher storage S3 local, pois a imagem do MinIO saiu do Docker Hub | `modulos/uploads`, `adapters/storage`                                                   |
| B      | [ ] S2-5 Disponibilidade, bloqueios e feriados (RN-30, RN-44)                                                                       | `modulos/agenda`, `core/agenda`, `app/(painel)/config/agenda`                           |
| B      | [ ] S2-6 Geração de slots com antecedência mínima e fuso (RN-30 a RN-32)                                                            | `core/agenda`                                                                           |
| B      | [ ] S2-7 Reserva atômica sem overbooking (RN-33)                                                                                    | `modulos/agenda`                                                                        |

## Sprint 3 — Acessos e painel · Reunião

| Trilha | História                                                                                                | Pastas                                       |
| ------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| A      | [ ] S3-1 Etapa de acessos por parceiro, com instruções por plataforma (RN-22, RN-27, RN-29, D-05, D-06) | `modulos/acessos`, `_etapas/acessos`         |
| A      | [ ] S3-2 Agência marca acesso como concedido/inválido (RN-28)                                           | `modulos/acessos`                            |
| A      | [ ] S3-3 Painel de onboardings com filtros (RN-63, RN-64)                                               | `modulos/painel`, `app/(painel)/onboardings` |
| B      | [ ] S3-4 Google Calendar + Meet com retentativa (RN-34, RN-67)                                          | `adapters/calendario`, `modulos/agenda`      |
| B      | [ ] S3-5 Reagendamento, limite e não comparecimento (RN-35 a RN-37)                                     | `modulos/agenda`, `core/agenda`              |
| B      | [ ] S3-6 Etapa "reunião" na página do cliente                                                           | `_etapas/reuniao`                            |

## Sprint 4 — Acompanhamento · Captação e prazo

| Trilha | História                                                                      | Pastas                                            |
| ------ | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| A      | [ ] S4-1 Máquina de estados; pausar, cancelar e reabrir (RN-49 a RN-54)       | `core/estados`, `modulos/onboarding/estados`      |
| A      | [ ] S4-2 Detalhe do onboarding com timeline e ações rápidas (RN-65, RN-66)    | `modulos/painel`, `app/(painel)/onboardings/[id]` |
| A      | [ ] S4-3 Auditoria consultável, exportação e exclusão de dados (RN-73, RN-77) | `modulos/lgpd`                                    |
| B      | [ ] S4-4 Captação dependente da reunião, com local (RN-38 a RN-42)            | `modulos/captacao`, `_etapas/captacao`            |
| B      | [ ] S4-5 Prazo em dias úteis e recálculo (RN-43 a RN-46)                      | `core/prazo`, `modulos/prazo`                     |
| B      | [ ] S4-6 Ajuste manual do prazo e indicadores (RN-47, RN-48)                  | `modulos/prazo`                                   |

## Sprint 5 — Envio de mensagens · Lembretes e alertas

Os dois lados usam o contrato de mensageria criado na S1-1, então avançam em paralelo.

| Trilha | História                                                                                          | Pastas                                               |
| ------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A      | [ ] S5-1 Templates editáveis com variáveis (RN-55, seção 8)                                       | `modulos/templates`, `app/(painel)/config/templates` |
| A      | [ ] S5-2 Envio por e-mail e WhatsApp (MegaAPI), fallback, log e retentativa (RN-60 a RN-62, D-07) | `adapters/mensageria`, `modulos/notificacoes/envio`  |
| B      | [ ] S5-3 Lembretes de pendência e de compromisso, janela de envio (RN-56, RN-57, RN-59)           | `modulos/notificacoes/lembretes`, `core/lembretes`   |
| B      | [ ] S5-4 Alertas internos e convite automático (RN-09, RN-58)                                     | `modulos/notificacoes/alertas`                       |

## Sprint 6 — Endurecimento (as duas trilhas)

| Trilha | História                                                              | Pastas                   |
| ------ | --------------------------------------------------------------------- | ------------------------ |
| A      | [ ] S6-1 Proteções do link público: rate limit, headers, CSRF (RN-76) | `apps/api/src/base/http` |
| A      | [ ] S6-2 Tela de resumo após a conclusão (RN-14)                      | `app/o/[token]/resumo`   |
| B      | [ ] S6-3 Teste ponta a ponta do fluxo feliz (critérios da seção 12)   | `e2e/`                   |
| B      | [ ] S6-4 Correções da homologação final                               | conforme o bug           |
