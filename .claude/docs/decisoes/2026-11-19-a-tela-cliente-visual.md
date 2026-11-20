# Tela do cliente mais visual e com menos carga cognitiva

- **Data / trilha:** 2026-11-19 / A
- **Contexto:** o PO achou a página do cliente (`/o/[token]`) funcional, mas pouco visual: um formulário longo, etapas parecidas entre si e muitas informações ao mesmo tempo. Pediu uma interface baseada em referências do mercado.
- **Referências usadas:**
  - **Typeform e GOV.UK ("one thing per page"):** uma pergunta por vez reduz o esforço de ler e decidir. Contador "Pergunta 3 de 12".
  - **Calendly e padrões de agendamento (Baymard):** uma faixa de dias no topo e só os horários do dia escolhido, já mostrando o primeiro dia com vaga.
  - **Portais de onboarding (Stripe, Airbnb para anfitriões, checklists de SaaS):** passos numerados ligados por uma linha, "Passo X de 4", uma frase dizendo o porquê de cada passo, só as tarefas do cliente e aviso de que o progresso fica salvo.
- **Decisão (técnica, dentro do pedido do PO):**
  - Casca: linha do tempo com 4 passos no topo (concluído em verde, atual em destaque, bloqueado com cadeado) e cartão de cada etapa com ícone, "Passo X de 4", título, uma frase de contexto e o status.
  - Etapa bloqueada: diz o que falta e tem um botão que leva até a etapa pendente.
  - Acessos: um cartão por rede, passos numerados e um botão "Copiar" no identificador da agência.
  - Formulário: no primeiro preenchimento, uma pergunta por vez, com "Voltar" e "Continuar". Depois de enviado, a edição mostra todas as perguntas juntas, como antes.
  - Horários: uma faixa de dias e os horários do dia escolhido. Horário marcado aparece como um cartão com a data em destaque.
  - Mantém a marca (creme, petróleo, laranja, Fraunces), as regras de celular (360px, toque ≥ 44px, campos ≥ 16px) e os nomes acessíveis usados nos testes.
- **Entrega:** três PRs pequenos (casca e acessos; formulário; horários).
