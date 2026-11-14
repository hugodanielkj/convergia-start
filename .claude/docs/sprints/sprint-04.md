# Sprint 4 — Acompanhamento · Captação e prazo

**Status:** trilha A concluída (2026-11-14).

## Trilha A — PO

**Objetivo:** o onboarding muda de status sozinho conforme o cliente avança, a agência pode pausar, cancelar e reabrir com motivo, vê tudo de um cliente numa tela de detalhe com linha do tempo, e consegue exportar ou excluir os dados de um cliente a pedido (LGPD).

**Ordem:** S4-1 → S4-3 → S4-2. A tela de detalhe (S4-2) usa as ações da S4-1 e os botões de exportar/excluir da S4-3, então fica por último.

| ID   | História                                       | Critérios de aceite                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Modelo / esforço |
| ---- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S4-1 | Máquina de estados; pausar, cancelar e reabrir | Transições válidas da RN-49 numa regra pura (`core/estados`); qualquer outra é rejeitada pelo backend (seção 7). O status avança sozinho a partir das etapas e dos agendamentos (RN-50, RN-51). Responsável ou Admin registra a entrega dos primeiros conteúdos e confirma o encerramento; sem confirmação, conclui sozinho N dias após a entrega (config `diasConclusaoAutomatica`) (RN-52). Só o Admin pausa, retoma e cancela, sempre com motivo; cancelar invalida o link e cancela os agendamentos futuros (RN-53). Reabrir etapa concluída com motivo (RN-54). Toda mudança de status é auditada (RN-77) e publica evento para lembretes, prazo e mensagens (trilha B e S5). | Opus / alto      |
| S4-3 | Auditoria consultável, exportação e exclusão   | API lista a auditoria de um onboarding/cliente com filtros (período, ação), só da própria agência (RN-75). Admin exporta todos os dados de um cliente num arquivo e exclui os dados a pedido, com confirmação; a exclusão apaga também os arquivos enviados e deixa só um registro de auditoria sem dados pessoais (RN-73). Revisão da cobertura da RN-77: o que faltar na trilha A é corrigido; o que faltar na trilha B vira aviso.                                                                                                                                                                                                                                              | Opus / alto      |
| S4-2 | Detalhe do onboarding com timeline e ações     | Tela `/onboardings/[id]` com linha do tempo (auditoria), respostas do formulário, status de cada acesso, agendamentos, histórico de notificações e ações rápidas: regenerar link, fechar formulário (pendência da S2), pausar, retomar, cancelar, reabrir etapa, registrar entrega, encerrar, exportar e excluir dados (RN-65). O nome do cliente no painel leva a ela. Ações que dependem de outras histórias aparecem desabilitadas com o aviso de quando chegam. A regra do intervalo mínimo entre reenvios de lembrete fica pronta no `core` (RN-66) para a S5 usar.                                                                                                           | Sonnet / médio   |

### Status automático (proposta para RN-49)

| Situação                                                            | Status                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Cliente ainda não abriu o link                                      | `criado` (`convite_enviado` só com o envio automático da S5, D-23) |
| Abriu o link; formulário ou acessos pendentes                       | `em_andamento`                                                     |
| Formulário e acessos concluídos; falta agendar reunião ou captação  | `aguardando_agendamentos`                                          |
| Tudo agendado; reunião ainda não realizada                          | `aguardando_reuniao`                                               |
| Reunião realizada; captação agendada e não realizada                | `aguardando_captacao`                                              |
| Captação realizada                                                  | `em_producao`                                                      |
| Responsável registrou a entrega                                     | `primeiro_conteudo_entregue`                                       |
| Responsável confirmou o encerramento, ou passaram N dias da entrega | `concluido`                                                        |

`pausado` e `cancelado` são laterais: o status automático não mexe neles.

## Decisões (trilha A)

- Status automático conforme a tabela acima; pausa não trava o cliente (só lembretes e alertas); só o Admin pausa, retoma e cancela; cancelar é definitivo; "Reabrir etapa" só para o formulário. `decisoes/2026-11-14-a-estados-onboarding.md`.
- Exportação em JSON (Admin); exclusão só pelo Admin com onboarding cancelado ou concluído, apagando tudo menos a auditoria (que fica sem dados pessoais); auditoria consultada pela linha do tempo do detalhe. `decisoes/2026-11-14-a-lgpd-exportar-excluir.md`.

## Entregue

### Trilha A

As 3 histórias mergeadas na `hml`, com CI verde:

- S4-1 Máquina de estados (#34): status avança sozinho; Admin pausa, retoma e cancela com motivo; responsável registra entrega e encerra; conclusão automática após N dias; reabrir formulário com motivo.
- S4-3 Auditoria, exportação e exclusão (#35): linha do tempo consultável com filtros; exportação em JSON e exclusão definitiva pelo Admin.
- S4-2 Detalhe do onboarding (este PR): tela `/onboardings/[id]` com linha do tempo, respostas, acessos, agendamentos, arquivos e ações rápidas; o nome do cliente no painel leva a ela. Regra da RN-66 pronta no `core` para a S5.

## Retro

### Trilha A

- **Funcionou:** regra pura no `core` primeiro, depois a API; um evento (`onboarding.etapas_mudaram`) como única porta para mudar o status evita as duas trilhas gravarem status contraditórios. A tela pede à API quais ações cabem, então não repete regra.
- **Atenção:** cancelar o onboarding cancela os agendamentos futuros direto no banco; o calendário da trilha B (#32) precisa reagir a `onboarding.status_alterado` para remover os eventos do Google. Agendamento realizado/cancelado da trilha B deve publicar `onboarding.etapas_mudaram` para o status andar sozinho.
- **Pendências:** reenviar convite e lembrete, histórico de notificações e aviso de cancelamento ao cliente (S5); ajustar prazo (S4-6, trilha B); auditar edição de cliente quando a rota existir (trilha B).

## Trilha B — colaborador

**Objetivo:** o cliente agenda a captação só depois da reunião, informa o local, e recebe a previsão de liberação dos primeiros conteúdos em dias úteis, recalculada quando a captação muda; a agência vê o prazo com indicador no painel e pode ajustá-lo com justificativa.

**Ordem:** S4-4 → S4-5 → S4-6.

| ID   | História                                  | Critérios de aceite                                                                                                                                                                                                                                                                     | Modelo         |
| ---- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| S4-4 | Captação dependente da reunião, com local | Sem reunião agendada a etapa fica bloqueada com explicação; horários só a partir do intervalo mínimo após a reunião, também ao reagendar (RN-39); local obrigatório se presencial, contato e observações (RN-40); regras de reserva da reunião (RN-41).                                 | Sonnet / médio |
| S4-5 | Prazo em dias úteis e recálculo           | Prazo = dia da captação + N dias úteis, sem fim de semana, feriado nacional e bloqueios (RN-43, RN-44); só aparece depois da captação agendada (RN-45); recalcula quando a captação muda de dia, desfaz se cancelada ou falta, auditado, com evento para a S5 avisar o cliente (RN-46). | Opus / alto    |
| S4-6 | Ajuste manual do prazo e indicadores      | Responsável ou Admin ajusta com justificativa, auditado e com evento para avisar o cliente (RN-47); painel mostra data e indicador `no_prazo`/`atencao`/`atrasado` e filtra por ele (RN-48, RN-64).                                                                                     | Opus / alto    |

### Decisões (trilha B)

- Captação bloqueada até a reunião; intervalo aplicado na geração dos horários; dados do local em tabela própria. `decisoes/2026-11-14-b-captacao-dependente-da-reuniao.md`.
- Prazo contado a partir do dia seguinte à captação e gravado (um bloqueio novo não muda um prazo já comunicado). `decisoes/2026-11-14-b-prazo-liberacao.md`.
- Ajuste manual substituído se a captação mudar de dia (aprovado pelo PO); atenção com até 2 dias úteis; mudança mínima no painel da trilha A (aprovada pelo PO). `decisoes/2026-11-14-b-ajuste-e-indicador-prazo.md`.

### Entregue

- S4-4 Captação dependente da reunião (#38).
- S4-5 Prazo em dias úteis e recálculo (#41), com a correção do worker do calendário que derrubava um teste de vez em quando.
- S4-6 Ajuste manual e indicadores (este PR).

### Retro

- **Funcionou:** recálculo idempotente disparado pelos eventos da agenda; a agenda não sabe que o prazo existe.
- **Atenção:** as notificações ao cliente (prazo comunicado, recalculado, ajustado) dependem da S5 consumir `prazo.alterado`. Testes de integração que varrem dados de todas as agências (worker do calendário) podem pegar linhas de outros arquivos: preferir agência própria por teste.
- **Pendências:** RN-42 (profissional de captação diferente, depende de agenda por profissional); local da captação no detalhe do onboarding; alerta interno de prazo em atenção/atrasado (RN-58, S5).
