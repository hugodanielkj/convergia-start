# Cadastro da equipe e escolha do responsável

- **Data / trilha:** 2026-11-19 / A
- **Decisão (PO):**
  - O Admin cadastra cada pessoa com nome, e-mail Google e papel (admin ou membro). Não sai e-mail de convite: a pessoa entra com "Entrar com Google" (D-21).
  - Ao desativar alguém com onboardings em andamento, o Admin escolhe quem assume (padrão: o próprio Admin). A pessoa perde o login na hora. Reativar devolve o login, sem devolver os onboardings.
  - O Admin escolhe o responsável no cadastro do cliente e pode trocá-lo no detalhe do onboarding (RN-08).
  - Fica para depois: o Admin liberar um onboarding para um membro que não é o responsável (parte final da RN-02). Por enquanto, o membro vê só os seus.
- **Decisão (técnica):**
  - O Admin não desativa nem rebaixa a si mesmo, e a agência nunca fica sem Admin ativo (senão ninguém mais configura nada).
  - O e-mail é guardado em minúsculas e é único na agência. Desativar apaga as sessões abertas.
  - Cadastrar, editar, desativar, reativar e trocar responsável ficam na auditoria (RN-77).
- **Motivo:** hoje só existe o Admin criado pelo seed; sem isso a agência não usa o sistema com a equipe.
