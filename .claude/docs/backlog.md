# Product Backlog

Status: `[ ]` a fazer · `[~]` em andamento · `[x]` pronto (merge em `main`).
Ordem = prioridade. O PO pode reordenar. Cada história cita as RN que cobre.

## Definition of Done

- Critérios de aceite atendidos e testes automatizados citando as RN.
- `pnpm check` e CI verdes; sem `any`, sem `TODO` sem história associada.
- Nenhum valor de prazo/texto/horário fixo no código (vem de configuração).
- PR revisado e aprovado pelo PO; `decisoes.md` atualizado se houve decisão nova.

## Sprint 0 — Fundação

- [x] S0-1 Estrutura `.claude/`, monorepo, lint, testes, Docker e CI.

## Sprint 1 — Cadastro e link único

- [ ] S1-1 Schema Prisma inicial (agência, usuário, cliente, onboarding, etapas, config, auditoria) + seed da agência (RN-75, D-01). Adicionar serviço Postgres na CI e testes de integração `*.int.test.ts`.
- [ ] S1-2 Login da equipe e papéis admin/membro (RN-02, RN-03). Decisão de método de login a propor ao PO.
- [ ] S1-3 Cadastro de cliente com validação e alerta de duplicidade (RN-04, RN-05, RN-07, RN-08).
- [ ] S1-4 Criação automática do onboarding com 4 etapas (RN-06).
- [ ] S1-5 Link único: geração, expiração, regeneração, isolamento (RN-10 a RN-13).
- [ ] S1-6 Ambiente de homologação publicado a partir de `hml` (depende do PO).

## Sprint 2 — Página do cliente e formulário

- [ ] S2-1 Página do cliente: boas-vindas, consentimento LGPD, barra de progresso (RN-14, RN-50, RN-72).
- [ ] S2-2 Modelo de formulário versionado e editável (RN-15, RN-16, RN-19).
- [ ] S2-3 Preenchimento com rascunho automático e conclusão (RN-17, RN-18, RN-21).
- [ ] S2-4 Upload de arquivos com validação no servidor (RN-20).

## Sprint 3 — Acessos e painel

- [ ] S3-1 Etapa de acessos por parceiro, com instruções por plataforma (RN-22, RN-27, RN-29, D-05, D-06).
- [ ] S3-2 Agência marca acesso como concedido/inválido (RN-28).
- [ ] S3-3 Painel de onboardings com filtros (RN-63, RN-64).

## Sprint 4 — Reunião

- [ ] S4-1 Disponibilidade, bloqueios e feriados (RN-30, RN-44).
- [ ] S4-2 Geração de slots com antecedência mínima e fuso (RN-30 a RN-32).
- [ ] S4-3 Reserva atômica sem overbooking (RN-33).
- [ ] S4-4 Google Calendar + Meet: criar/atualizar/cancelar evento, com retentativa (RN-34, RN-67).
- [ ] S4-5 Reagendamento, limite e não comparecimento (RN-35 a RN-37).

## Sprint 5 — Captação e prazo

- [ ] S5-1 Agendamento da captação dependente da reunião (RN-38 a RN-42).
- [ ] S5-2 Cálculo do prazo em dias úteis e recálculo (RN-43 a RN-46).
- [ ] S5-3 Ajuste manual do prazo e indicadores (RN-47, RN-48).

## Sprint 6 — Notificações

- [ ] S6-1 Templates editáveis com variáveis (RN-55, seção 8).
- [ ] S6-2 Envio por e-mail e WhatsApp (MegaAPI), fallback de canal, log e retentativa (RN-60 a RN-62, D-07).
- [ ] S6-3 Lembretes de pendência e de compromisso, janela de envio (RN-56, RN-57, RN-59).
- [ ] S6-4 Alertas internos (RN-58).

## Sprint 7 — Acompanhamento e endurecimento

- [ ] S7-1 Máquina de estados do onboarding e ações de pausar/cancelar/reabrir (RN-49 a RN-54).
- [ ] S7-2 Tela de detalhe com timeline e ações rápidas (RN-65, RN-66).
- [ ] S7-3 Auditoria, exportação e exclusão de dados (RN-73, RN-77).
- [ ] S7-4 Proteções do link público: rate limit, headers, CSRF (RN-76).
- [ ] S7-5 Teste ponta a ponta do fluxo feliz (critérios de aceite da seção 12).
