# Reagendamento: o mesmo registro muda de horário

- **Data / trilha:** 2026-11-14 / B
- **Decisão:** reagendar não cria outro agendamento: o registro existente troca de horário, vai para `reagendado` e conta +1 em `reagendamentos`. O horário antigo fica livre no mesmo instante, porque o registro deixa de ocupá-lo. O cliente reagenda enquanto `reagendamentos < limite_reagendamentos` e faltarem pelo menos `antecedencia_reagendamento_horas` para o horário atual (RN-35); recusado, a resposta manda contatar a agência. Cancelar é só da agência (RN-36), com motivo, e vale para o Admin ou o responsável pelo onboarding. `agendado` e `reagendado` são os dois estados ativos: a partir de ambos a agência pode marcar `realizado`, `nao_compareceu` ou `cancelado`; os três são finais. O cliente não pode reagendar para o mesmo horário que já tem.
- **Motivo:** manter um registro por reunião preserva o histórico em auditoria e deixa a restrição de exclusão do banco decidir a disputa pelo novo horário, como na reserva. A spec (seção 7) descreve `agendado → reagendado → agendado`, o que se lê como o mesmo agendamento mudando de horário.
- **Substitui:** —
