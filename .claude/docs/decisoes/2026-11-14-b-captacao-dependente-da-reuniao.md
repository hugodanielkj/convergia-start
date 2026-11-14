# Captação depende da reunião e guarda os dados do local

- **Data / trilha:** 2026-11-14 / B
- **Decisão:** não há horário de captação enquanto o onboarding não tiver reunião agendada ou realizada (a etapa aparece `bloqueada` com explicação); com a reunião, só valem horários em dias de calendário (fuso da agência) com pelo menos `intervalo_reuniao_captacao_dias_min` de distância do dia da reunião. A regra é aplicada na geração de slots, então vale igual para listar, reservar e reagendar. Local, contato e observações ficam em `dados_captacao` (1:1 com o agendamento); `presencial` é um campo que o cliente marca (padrão sim) e, sendo presencial, o local é obrigatório. A reserva da captação sem esses dados é recusada (422) e o agendamento não é criado. A situação da etapa é derivada dos agendamentos (rota `GET /publico/onboardings/:token/captacao`), como já é na reunião.
- **Motivo:** uma única regra no ponto onde os slots nascem impede que alguém contorne o intervalo reagendando; derivar a situação evita guardar um status que pode ficar defasado.
- **Pendente:** RN-42 (profissional de captação diferente do responsável) segue a D-02: a agenda tem um profissional só; muda quando houver agenda por profissional. A agência ainda não vê o local no detalhe do onboarding (fica para uma história de painel).
- **Substitui:** —
