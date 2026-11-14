# Onboarding: estados, responsável padrão e um ativo por cliente

- **Data / trilha:** 2026-11-13 / B
- **Decisão:** o onboarding nasce com status `criado` e as quatro etapas `pendente`, gravado na mesma transação do cliente. Os onze status da RN-49 e os estados das etapas já existem como enums no banco e em `@convergia/core/onboarding` (`STATUS_ONBOARDING`, `TipoEtapa`, `StatusEtapa`); as **transições** entre eles continuam para a máquina de estados da S4-1 (trilha A). O responsável é o Admin ativo mais antigo da agência; só o Admin pode escolher outra pessoa (RN-08), e quem não é Admin recebe 403. "Ativo" é qualquer status menos `concluido` e `cancelado`; `pausado` continua ativo. A regra tem uma segunda barreira no banco: índice único parcial `onboardings_um_ativo_por_cliente`, escrito à mão na migração, que impede dois onboardings ativos mesmo com requisições simultâneas.
- **Motivo:** definir os enums agora evita a trilha A mexer em `onboarding.prisma` na S4-1 só para acrescentar valores. O índice parcial cobre a corrida que a checagem em código sozinha não cobre.
- **Substitui:** —
