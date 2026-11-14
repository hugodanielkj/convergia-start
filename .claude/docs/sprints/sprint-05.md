# Sprint 5 — Envio de mensagens · Lembretes e alertas

**Status:** trilha A concluída (2026-11-14).

## Trilha A — PO

**Objetivo:** a agência edita os textos das mensagens e o sistema consegue enviá-las por WhatsApp e e-mail, com registro de cada envio, novas tentativas e canal alternativo.

**Ordem:** S5-1 → S5-2 (a S5-2 usa os templates).

| ID   | História                          | Critérios de aceite                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Modelo / esforço |
| ---- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S5-1 | Templates editáveis com variáveis | Admin edita os 4 templates da seção 8 (convite, confirmação com prazo, lembrete de pendência, lembrete de compromisso); texto padrão da spec; restaurar padrão; pré-visualização com dados de exemplo. Ao salvar, recusa variável desconhecida e texto que peça senha (RN-29). Função pura que preenche o texto, para a trilha B usar nos lembretes (RN-55).                                                                                                                                          | Sonnet / médio   |
| S5-2 | Envio por e-mail e WhatsApp       | Serviço `enviarNotificacao` (contrato para a trilha B): usa o canal preferencial do cliente e, se falhar, o alternativo (RN-60); tudo registrado em `Notificacao` com status, canal e erro (RN-62); 3 tentativas com espera crescente, sem duplicar envio; adaptadores de WhatsApp (MegaAPI, D-07) e e-mail atrás da porta `Mensageria`; sem credenciais, fica pendente e sai depois; opt-out de lembretes por link na página do cliente (RN-61); histórico de notificações no detalhe do onboarding. | Opus / alto      |

## Decisões (trilha A)

- Os 4 templates da spec, com recusa de variável desconhecida e de pedido de senha; restaurar padrão e pré-visualização. `decisoes/2026-11-14-a-templates.md`.
- Opt-out de lembretes por link na página do cliente; sem credenciais, o envio fica pendente e sai quando configurar. `decisoes/2026-11-14-a-envio-mensagens.md`.

## Entregue

### Trilha A

As 2 histórias mergeadas na `hml`, com CI verde:

- S5-1 Templates (#40): `/config/templates` com os 4 textos da spec, pré-visualização, restaurar padrão; recusa variável desconhecida e pedido de senha.
- S5-2 Envio (este PR): fila `notificacoes` com WhatsApp (MegaAPI) e e-mail (Resend), canal alternativo, 3 tentativas por canal e pendência sem credenciais; opt-out em `/parar-lembretes/<token>`; histórico no detalhe do onboarding. Decisões do PO: Resend e canal padrão da agência.

## Retro

### Trilha A

- **Funcionou:** regra de retentativa pura no `core`, testada sem banco; o mesmo desenho do calendário (estado no banco + reserva) evitou montar fila agora.
- **Atenção:** o teste do worker do calendário (trilha B) falha às vezes com os testes rodando em paralelo; passa sozinho. O link do onboarding não pode ir nos lembretes, porque o token só é guardado como hash (D-13): a trilha B precisa decidir isso na S5-3/S5-4.
- **Pendências:** credenciais do Resend e da MegaAPI (PO); `.env.example` não foi atualizado (leitura bloqueada nas configurações); página `/config` segue 404.

## Trilha B — colaborador

(a trilha B preenche a sua seção)
