# LGPD: como a exportação, a exclusão e a auditoria foram implementadas

- **Data / trilha:** 2026-11-14 / A
- **Decisão:**
  - Rotas do módulo `lgpd`: `GET /onboardings/:id/auditoria` (Admin ou responsável; filtros `de`, `ate`, `acao` exata ou grupo terminado em ponto, `limite` até 500), `GET /clientes/:id/exportacao` e `POST /clientes/:id/exclusao` (só Admin; corpo `{ confirmacao }` com o nome da empresa).
  - A auditoria de um onboarding junta os registros dele, do cliente e dos agendamentos dele. Quem agiu aparece com nome (usuário), nome do contato (cliente) ou "sistema".
  - Na exclusão, os arquivos saem do storage antes do banco (repetir a exclusão não deixa arquivo órfão). Os registros de auditoria ficam, mas com `dados` apagados, porque alguns guardam texto livre (motivos). Um registro `cliente.dados_excluidos` guarda só contagens.
  - Contrato: a exclusão publica `cliente.dados_excluidos { clienteId, onboardingIds }`. Tabela nova ligada ao onboarding só por coluna (sem relação com `onDelete: Cascade`) precisa apagar as suas linhas ao receber o evento, e entrar na exportação.
  - Revisão da RN-77: criação de cliente e de onboarding, mudanças de status, regeneração de link e reabertura já são auditadas. Faltam, na trilha B: edição de cliente (ainda não há rota) e ajuste manual de prazo (S4-6). Credenciais não existem no MVP (D-05).
- **Motivo:** cumprir a RN-73 sem perder o rastro do que foi feito, e sem guardar dado pessoal depois do pedido de exclusão.
- **Substitui:** —
