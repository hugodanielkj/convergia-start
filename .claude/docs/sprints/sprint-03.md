# Sprint 3 — Acessos e painel · Reunião

**Status:** trilha A concluída (2026-11-14).

**Objetivo (trilha A):** o cliente concede acesso às redes por parceiro, com instruções claras; a agência confirma ou invalida cada acesso; e a agência enxerga todos os onboardings num painel com filtros.

## Ordem (trilha A)

S3-1 → S3-2 (mesmo módulo `acessos`) → S3-3.

## Trilha A — PO

| ID   | História                         | Critérios de aceite                                                                                                                                                                                                                                                                      | Modelo / esforço |
| ---- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S3-1 | Etapa de acessos por parceiro    | Cliente vê Instagram e Facebook (obrigatórios) e TikTok e Google (opcionais, D-06) com passo a passo e o identificador da agência a adicionar (RN-22); não há campo de senha (D-05, RN-29); status por plataforma e etapa concluída quando as obrigatórias estiverem concedidas (RN-27). | Sonnet / médio   |
| S3-2 | Agência marca concedido/inválido | Responsável ou admin marca cada plataforma como concedida ou inválida (com motivo, obrigatório no inválido); auditado; cliente vê o motivo e pode corrigir e reinformar (RN-28). Envio da notificação fica para a S5.                                                                    | Sonnet / médio   |
| S3-3 | Painel de onboardings            | Lista com cliente, responsável, status, progresso X/4, prazo e indicadores; filtros por status, responsável, etapa pendente, período e prazo (RN-63, RN-64); membro só vê os seus (RN-02).                                                                                               | Sonnet / médio   |

## Decisões (trilha A)

- Cliente avisa que adicionou a agência; só a agência marca concedido/inválido. Identificador da agência em tabela própria, sem mexer na config base. `decisoes/2026-11-14-a-acessos-por-parceiro.md`.
- Painel: prazo e próximo compromisso ficam "—" até as histórias da trilha B. `decisoes/2026-11-14-a-painel-onboardings.md`.

## Entregue

### Trilha A

Todas as 3 histórias mergeadas na `hml`, com CI verde:

- S3-1 Etapa de acessos por parceiro (#27): cliente vê passo a passo por plataforma, sem senha; `/config/acessos` define o identificador da agência.
- S3-2 Agência marca concedido/inválido (#28): tela `/onboardings/[id]/acessos`; motivo obrigatório no inválido; auditado.
- S3-3 Painel de onboardings com filtros (#29): `/onboardings`.

## Retro

### Trilha A

- **Funcionou:** regra pura no `core` com teste primeiro; migração só no PR; verificação no navegador pegou que o servidor de dev precisa reiniciar para enxergar módulo novo da API.
- **Atenção:** notificar o cliente do acesso inválido (RN-28) depende da mensageria (S5); por ora ele vê o motivo na página. Colunas de compromisso e prazo do painel dependem da trilha B. O painel ainda não linka para o detalhe (S4-2): o nome do cliente leva à tela de acessos.
- **Pendências:** botão "Fechar formulário" (S4-2); página `/config` ainda é 404; storage S3 no go-live.

## Trilha B — colaborador

| ID   | História                                   | Critérios de aceite                                                                                                                                                                                                                                                                                                                                                                                                                           | Modelo / esforço |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S3-5 | Reagendamento, limite e não comparecimento | Cliente reagenda até `limite_reagendamentos` vezes e até `antecedencia_reagendamento_horas` antes, e o slot antigo volta a ficar livre (RN-35, RN-36); depois do limite só a agência cancela; agência (Admin ou responsável) marca `realizado`, `nao_compareceu` e cancela com motivo (RN-37); transições inválidas são recusadas; eventos `agendamento.reagendado`, `.cancelado` e `.nao_compareceu` publicados para calendário e mensagens. | Sonnet / médio   |
| S3-6 | Etapa "reunião" na página do cliente       | O cliente vê os horários livres no fuso do navegador (com opção de trocar), escolhe, confirma, vê o agendamento com os reagendamentos que ainda tem e reagenda; se o horário for perdido a lista atualiza sozinha (RN-30 a RN-33, RN-35).                                                                                                                                                                                                     | Sonnet / médio   |
| S3-4 | Google Calendar com Meet e retentativa     | Ao confirmar, cria evento na agenda da agência com convite ao cliente e link do Meet; reagendar atualiza e cancelar remove o evento; falha da integração não corrompe o agendamento: `evento_externo_id` fica pendente e é tentado de novo com espera crescente (RN-34, RN-67). Adaptador atrás de interface (D-12) com versão em memória para teste. **A parte real depende das credenciais do Google Cloud, que só o PO fornece.**          | Opus / alto      |

**Ordem:** S3-5, S3-6 e S3-4. A S3-4 fica por último por depender de credenciais.

## Entregue — trilha B

(preencher ao fim)

## Retro — trilha B

(preencher ao fim)
