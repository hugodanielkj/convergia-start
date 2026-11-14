# Status do onboarding: automático, pausa e reabertura

- **Data / trilha:** 2026-11-14 / A
- **Decisão:**
  - O status avança sozinho a partir das etapas e dos agendamentos, conforme a tabela da seção trilha A de `sprints/sprint-04.md`. `convite_enviado` só passa a ser usado com o envio automático do convite (S5, D-23).
  - `primeiro_conteudo_entregue` e `concluido` são ações do responsável ou do Admin; sem confirmação, o onboarding conclui sozinho `diasConclusaoAutomatica` dias após a entrega.
  - Só o Admin pausa, retoma e cancela, sempre com motivo (RN-53). Durante a pausa o cliente **continua podendo preencher** pelo link; a pausa só interrompe lembretes e alertas. Ao retomar, o status volta a refletir as etapas.
  - Cancelar é definitivo: invalida o link e cancela os agendamentos futuros. Para recomeçar, cria-se um onboarding novo (RN-07 permite, porque cancelado não é ativo).
  - "Reabrir etapa" (RN-54) vale só para o formulário: destrava edição e reenvio pelo cliente, com motivo e auditoria. Acessos reabrem quando a agência marca uma plataforma como inválida (S3-2); reunião e captação, pelo reagendamento/cancelamento da trilha B.
- **Motivo:** escolhas do PO no planejamento da Sprint 4. Um único caminho para cada reabertura evita estados contraditórios entre módulos das duas trilhas.
- **Substitui:** —
