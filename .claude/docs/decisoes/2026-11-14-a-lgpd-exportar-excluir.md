# LGPD: exportação, exclusão e consulta da auditoria

- **Data / trilha:** 2026-11-14 / A
- **Decisão:**
  - **Exportação (RN-73):** só o Admin; um arquivo JSON com todos os dados do cliente (cadastro, onboardings, respostas, acessos, agendamentos, consentimentos e auditoria) e a lista dos arquivos enviados, que continuam sendo baixados um a um.
  - **Exclusão (RN-73):** só o Admin, só com o onboarding cancelado ou concluído, confirmando com o nome da empresa. Apaga de vez cliente, onboardings, respostas, arquivos (inclusive no storage), acessos, agendamentos, consentimentos e link. A auditoria fica, porque guarda só IDs e ações, e ganha um registro "dados excluídos" sem dados pessoais.
  - **Auditoria consultável:** pela linha do tempo do detalhe do onboarding (S4-2), apoiada numa rota da API com filtros. Sem página de auditoria separada no MVP (uma usuária, D-22).
- **Motivo:** escolhas do PO no planejamento da Sprint 4. JSON atende a portabilidade da LGPD com pouco código; apagar (e não anonimizar) é o pedido mais comum do titular.
- **Substitui:** —
