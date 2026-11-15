# Convite automático, reenvios e alertas internos

- **Data / trilha:** 2026-11-15 / B
- **Decisão (PO):**
  - **Convite (RN-09):** o cadastro envia o convite na hora (respeitando a janela), salvo se a pessoa marcar "Enviar convite depois". O status passa a `convite_enviado` quando o convite sai de fato.
  - **Reenvios (RN-66):** "Reenviar convite" e "Reenviar lembrete" respeitam o intervalo mínimo (`intervaloMinimoReenvioHoras`, padrão 24h) desde a última mensagem do mesmo tipo. O reenvio manual não conta no máximo de lembretes automáticos.
  - **Alertas (RN-58):** cliente concluiu as etapas; link aberto e nenhuma ação em `diasSemAcaoParaAlerta` dias; lembretes esgotados (24h depois do último, se ainda faltar etapa); acesso marcado como inválido; não comparecimento; prazo em `atencao` ou `atrasado`. Extras: mensagem que falhou no WhatsApp e no e-mail; cliente com link vencido pediu um novo.
  - **Onde:** página "Avisos" no painel, com contador no menu; o Admin vê todos e o membro vê os dos seus onboardings; "Resolver" tira o aviso para todos. E também e-mail ao responsável (se inativo, aos Admins).
  - Acesso inválido e não comparecimento marcados pelo próprio responsável não geram e-mail (o aviso aparece no painel do mesmo jeito).
  - Google Calendar e Meet não fazem parte do produto: nenhum alerta depende deles.
- **Decisão (técnica):**
  - Tabela própria de avisos (`alertas_internos`), com chave de idempotência por motivo: o mesmo fato não gera dois avisos. O e-mail sai pela porta `Mensageria` com retentativa, registrado no próprio aviso (a tabela `notificacoes` é só para mensagens ao cliente).
  - Alertas por evento (concluiu, acesso inválido, não compareceu, falha, link novo) e por varredura (sem ação, esgotados, prazo).
- **Motivo:** escolhas do PO no planejamento da Sprint 5 (trilha B).
- **Substitui:** D-23 (o convite deixa de ser só manual).
