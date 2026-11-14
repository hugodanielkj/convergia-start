# Liberação sequencial das etapas e navegação do cliente (S6-4)

- **Data / trilha:** 2026-11-14 / A
- **Regras:** RN-79 (nova), RN-39. Substitui a "ordem livre" da seção 5 da spec.
- **Decisão:**
  - Uma regra pura em `@convergia/core/liberacao` define o que libera cada etapa. Cada etapa tem uma condição de **feita**:
    - formulário: enviado;
    - acessos: o cliente avisou, ou a agência concedeu, em todas as plataformas escolhidas;
    - reunião: agendada ou realizada;
    - captação: agendada ou realizada.
  - Liberação: o formulário está sempre liberado. Cada etapa seguinte fica liberada se já foi feita, ou se a anterior está liberada e feita. Com isso, voltar atrás (formulário reaberto, acesso inválido) só trava de novo o que ainda não foi feito: uma reunião já agendada continua valendo (PO, 2026-11-14).
  - **Servidor:** o módulo `liberacao` (trilha A) expõe `GET /publico/onboardings/:token/etapas`, com status, liberada e feita de cada etapa, e a função `exigirEtapaLiberada`. Ações em etapa bloqueada recebem 422 (`ETAPA_BLOQUEADA`, RN-79). Essa função é chamada em três lugares: no aviso de acesso, na reserva da reunião e na reserva da captação. As duas reservas são da trilha B e ganharam só uma linha cada.
  - **Página do cliente:** no topo ficam a barra de progresso e 4 botões, um por etapa. Aparece uma etapa por vez, e a página abre na primeira etapa liberada que ainda não foi feita. Uma etapa bloqueada abre só para leitura: o conteúdo fica inerte (`inert`) e um alerta diz que as anteriores precisam ser concluídas.
  - **Contrato de avanço:** a casca oferece `useAvancoEtapa()` em `app/o/[token]/_componentes/NavegacaoEtapas.tsx`. A etapa chama `avancar()` depois de concluir sem erro, e a casca recarrega os dados e abre a próxima etapa. As etapas não sabem a ordem.
- **Motivo:** o primeiro cliente se perdeu com as 4 etapas empilhadas. A ordem guiada reduz dúvida e evita marcar reunião antes de a agência ter os acessos.
