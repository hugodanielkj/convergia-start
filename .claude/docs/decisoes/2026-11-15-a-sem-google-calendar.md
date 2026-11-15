# Sem Google Calendar e Google Meet no MVP

- **Data / trilha:** 2026-11-15 / A (decisão do PO)
- **Decisão:**
  - O Google Calendar e o Google Meet **não serão usados**. Nenhum evento é criado na agenda da agência, e o cliente não recebe convite do Google (RN-34, RN-36 e RN-67 revisadas).
  - **O código da integração (S3-4, `2026-11-14-b-calendario-google.md`) fica no projeto, desligado.** Ele só liga com `GOOGLE_CALENDAR_REFRESH_TOKEN`, e essa variável não será configurada. Escolha do PO: não remover agora.
  - **Link da reunião:** o sistema não tem. O cliente vê só a data e a hora; a agência combina o link por fora (WhatsApp, por exemplo). O texto da etapa Reunião passou a ser "A agência vai te enviar o link da videochamada." Lembretes e confirmações não levam link de videochamada.
  - **Conflitos de agenda:** evitados só pela disponibilidade e pelos bloqueios cadastrados em `/config/agenda` (RN-30, RN-44). A agência precisa manter os bloqueios em dia, porque o sistema não enxerga a agenda pessoal dela.
  - O **login com Google** (D-21) continua; ele não depende do Calendar.
- **Substitui em parte:** D-03 (reunião online "com link do Google Meet") e D-04 (calendário Google Calendar). A reunião continua online.
- **Consequências:** sai do go-live a verificação do app no Google para o Calendar. O critério 1 da seção 12 (fluxo feliz) não exige mais evento no calendário; vale para a S7-3.
