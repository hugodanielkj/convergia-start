# Etapa concluída ao agendar, confirmação final, pedido de reagendamento e horário pela agência

- **Data / trilha:** 2026-11-19 / A
- **Contexto:** ao planejar o teste do fluxo feliz (S7-3), apareceram duas falhas: as etapas Reunião e Captação nunca ficavam `concluida` (então o aviso "cliente concluiu" nunca saía) e a "Confirmação final com prazo" (seção 8) nunca era enviada.
- **Decisão (PO):**
  - A etapa Reunião (e a Captação) fica `concluida` quando o cliente marca o horário. Se o horário for cancelado ou o cliente faltar, volta a `pendente`.
  - A confirmação final sai uma vez, na hora (sem esperar a janela de envio), quando as 4 etapas ficam concluídas e o prazo foi calculado. Se a captação for reagendada, sai de novo com a data nova (RN-46).
  - O cliente continua reagendando sozinho dentro do limite (RN-35). Passado o limite, ou com menos antecedência que a configurada, aparece "Pedir para reagendar", com um motivo: vira aviso para a agência.
  - A agência (Admin ou responsável) altera o horário no detalhe do onboarding: qualquer data e hora, mesmo fora do horário de atendimento, sem bater com outro agendamento. Não gasta o limite do cliente. O cliente recebe aviso do novo horário e, se for a captação, o prazo é recalculado.
  - Tudo entra na Sprint 8: S8-3 (etapa concluída e confirmação) e S8-4 (pedido e alteração de horário).
- **Decisão (técnica):**
  - A regra da etapa fica no `core` (`statusEtapaAgendada`) e o módulo de estados sincroniza a etapa a cada evento de agendamento, avisando os outros módulos quando ela muda.
  - A confirmação tem chave com o prazo e o horário da captação: o mesmo fato nunca gera duas mensagens. Ela só sai quando o prazo já corresponde ao dia da captação, para não mandar um prazo velho.
  - Reagendar a reunião não gera confirmação nova (o PO escolheu só a captação).
- **Substitui:** complementa RN-35, RN-46 e o critério 1 da seção 12.
