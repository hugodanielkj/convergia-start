# Prazo de liberação: contado a partir do dia seguinte e gravado

- **Data / trilha:** 2026-11-14 / B
- **Decisão:** prazo = dia da captação (fuso da agência) + `prazo_producao_dias_uteis` dias úteis; o dia da captação não conta, o primeiro dia útil depois dele é o dia 1 (captação na sexta com 1 dia útil = segunda). Dia útil é o da RN-44 (`diaUtil` do `core/agenda`). O prazo é **gravado** (`prazos_liberacao`, um por onboarding) quando a captação é agendada e só muda quando a captação muda de dia, é cancelada ou o cliente não comparece; nesses dois últimos casos o prazo é desfeito e volta a "será definido após o agendamento da captação" (RN-45). Trocar o horário no mesmo dia não recalcula nem avisa. Bloqueio, feriado ou prazo de produção alterados depois **não** mudam um prazo já comunicado. Cada mudança é auditada (ator `sistema`) e publica `prazo.alterado` (`anterior` nulo = primeira comunicação), que a S5 usa para notificar o cliente (RN-46).
- **Motivo:** a data é uma promessa feita ao cliente; recalcular sozinha por causa de um cadastro novo mudaria a promessa sem aviso. O recálculo lê o estado atual, então pode rodar de novo sem efeito colateral.
- **Substitui:** —
