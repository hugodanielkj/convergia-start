# Agenda em calendário com exceção por dia

- **Pedido do PO (2026-11-23):** em `/config/agenda`, o horário padrão continua sendo cadastrado uma vez (botão "Horário padrão de atendimento"), mas a tela principal é um calendário (semana por padrão, mês opcional) onde o Admin muda o horário de **um dia específico**.
- **Regra (RN-30):** a exceção de um dia **substitui** as janelas semanais daquele dia, por tipo (reunião ou captação). Vale só para a data; sem exceção, vale o padrão. Bloqueios e feriados nacionais continuam valendo sobre a exceção. Dia passado não é editável.
- **Como:** tabela `disponibilidades_dia` (várias linhas por dia); `PUT /agenda/excecoes` troca tudo do dia (lista vazia = voltar ao padrão); `GET /agenda/excecoes` devolve também o "hoje" no fuso da agência. `gerarSlots` recebe `excecoes` (core/agenda). Dia fechado inteiro = bloqueio de um dia (já existia).
- **Tela:** navegação por URL (`?visao=semana|mes&data=&dia=`), sem estado no cliente, a 360px o mês tem 7 colunas ≥ 44px e a semana vira lista.
- **Agendamentos já marcados** num dia que perdeu horário não são cancelados; só deixam de aparecer novos horários (o PO avisa o cliente pelo fluxo de reagendamento existente).
