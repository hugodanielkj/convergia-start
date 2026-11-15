# Lembretes, janela de envio e tela de configuração

- **Data / trilha:** 2026-11-15 / B
- **Decisão (PO):**
  - **Pendência (RN-56):** nos dias da configuração (padrão D+1, D+3 e D+5) contados a partir do envio do convite, só enquanto faltar alguma etapa. Cada lembrete lista o que falta. No máximo `maxLembretesPendencia` (padrão 3); depois, só alerta interno. Sem convite enviado, não há lembrete.
  - **Compromisso (RN-57):** nas horas da configuração (padrão 24h e 2h) antes de reunião e captação, com o `localOuLink` do agendamento como estiver (não há Google Calendar nem Meet).
  - **Janela (RN-59):** o horário permitido (padrão 08h–20h, sem domingo, no fuso da agência) vale para o que sai sem ação do cliente: convite automático, lembretes e reenvios da agência. Fora dele, a mensagem espera o próximo horário permitido. Respostas a uma ação do cliente (ex.: confirmação de agendamento) saem na hora.
  - **Lembrete de compromisso fora da janela:** é antecipado para o último horário permitido antes. Se cair no mesmo horário do lembrete anterior, sai um só. Se não houver horário permitido entre agora e o compromisso, não sai.
  - Pausado, cancelado, concluído e quem pediu para parar (opt-out) não recebem lembrete (regras da S5-2).
  - **Tela Configurações › Lembretes**, só Admin: dias da pendência, máximo, horas antes do compromisso, início e fim da janela e dias permitidos.
- **Decisão (técnica):**
  - Regras puras em `@convergia/core/lembretes` (quando cada lembrete vence, próximo e último horário permitido, texto do que falta).
  - Worker em `modulos/notificacoes/lembretes` que varre a cada minuto e enfileira pelo contrato da S5-2 (`enfileirarNotificacao`). A chave de idempotência evita duplicar: `lembrete_pendencia:<onboarding>:<n>` e `lembrete_compromisso:<agendamento>:<início>:<horas>`, então um reagendamento gera lembretes novos para o novo horário.
  - Respeitar a janela é um campo da notificação: o worker de envio (S5-2) adia para o próximo horário permitido também as retentativas e as pendências sem credencial.
  - "Convite enviado em" = primeiro envio com sucesso da notificação `convite`.
- **Motivo:** escolhas do PO no planejamento da Sprint 5 (trilha B).
- **Substitui:** —
