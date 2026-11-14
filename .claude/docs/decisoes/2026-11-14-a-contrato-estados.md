# Máquina de estados: contrato com os outros módulos

- **Data / trilha:** 2026-11-14 / A
- **Decisão:**
  - Regra pura em `@convergia/core/estados`: mapa de transições (`transicaoPermitida`, `garantirTransicao`), status derivado (`derivarStatus`, `proximoStatusAutomatico`), ações da agência (`destinoDaAcao`) e `recebeLembretes(status)` (falso para pausado, cancelado e concluído, RN-53).
  - Histórico na tabela `transicoes_status` (de, para, motivo, ator, em). A data da entrega dos primeiros conteúdos é a última transição para `primeiro_conteudo_entregue`; retomar de uma pausa recomeça a contagem da conclusão automática.
  - **Para mudar o status, um módulo não grava `statusGeral`.** Depois de mudar etapa ou agendamento, publica `onboarding.etapas_mudaram { onboardingId, ator }` (ou chama `avisarEtapasMudaram`) e a máquina recalcula. Ela já reage a `agendamento.criado`.
  - Toda mudança publica `onboarding.status_alterado { onboardingId, de, para, motivo, agendamentosCancelados }`. Lembretes, prazo e mensagens reagem a ele.
  - Cancelar o onboarding cancela na mesma transação os agendamentos ativos com início no futuro, audita cada um como `agendamento.cancelado` e manda os IDs em `agendamentosCancelados`. O calendário (trilha B) deve remover esses eventos ao receber o evento.
  - Conclusão automática (RN-52): rotina dentro da API que roda de hora em hora, como o worker do calendário. Passa para a fila (BullMQ) junto com ele na S5.
- **Motivo:** um único lugar decide o status, então as duas trilhas não gravam status contraditórios; os eventos evitam importar código de um módulo no outro.
- **Substitui:** —
