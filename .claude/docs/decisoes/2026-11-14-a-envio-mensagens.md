# Envio de mensagens: canais, opt-out, credenciais e contrato

- **Data / trilha:** 2026-11-14 / A
- **Decisão (PO):**
  - E-mail pelo **Resend** (HTTP, sem biblioteca); WhatsApp pela MegaAPI (D-07).
  - O cliente não tem "canal preferido": vale o canal padrão da agência (`canalNotificacaoPadrao`); se o cliente só tem um contato, usa esse; se falhar, tenta o outro (RN-60).
  - Opt-out de lembretes por link `/parar-lembretes/<token>` (RN-61). Abrir a página não desativa: só o botão (POST), porque a pré-visualização de links do WhatsApp abre a página sozinha. Vale só para lembretes; convite e confirmações continuam. O token é único por onboarding e fica em claro, porque precisa entrar em todo lembrete e só serve para parar lembretes.
  - Sem credenciais, a mensagem fica pendente (sem gastar tentativa) e sai quando configurar.
- **Decisão (técnica):**
  - Tudo vai para a tabela `notificacoes` (RN-62): tipo, categoria, status (`pendente`, `enviada`, `falhou`, `cancelada`), canal, tentativas e erro curto. O destinatário não é gravado: sai do cadastro a cada tentativa.
  - Retentativa: até 3 tentativas por canal, esperando 1 e 5 minutos; erro definitivo (4xx, número sem WhatsApp) ou tentativas esgotadas passam ao outro canal na hora; sem nenhum canal configurado, espera 15 minutos. Falhou nos dois: publica `notificacao.falhou` (alerta da S5-4).
  - Worker dentro da API, como o do calendário: reage a `notificacao.enfileirada` e varre a cada 30 s; cada mensagem é reservada por 2 minutos, então dois processos não a enviam juntos. Entrega "pelo menos uma vez": se o processo cair entre o envio e a gravação, a mensagem pode sair de novo. Passa para a fila (BullMQ) junto com o calendário.
  - Variáveis: `MEGAAPI_HOST`, `MEGAAPI_INSTANCE_KEY`, `MEGAAPI_TOKEN` (juntas); `RESEND_API_KEY`, `EMAIL_REMETENTE` (juntas, remetente verificado no Resend); `EMAIL_ASSUNTO_PADRAO` (opcional).
  - **Contrato para as duas trilhas:** `enfileirarNotificacao(prisma, eventos, urlApp, { onboardingId, tipo, categoria, chave, assunto?, corpo }, agora)` em `apps/api/src/modulos/notificacoes/envio/enfileirar.ts`. A `chave` é de idempotência (a mesma chave nunca gera duas mensagens). O `corpo` chega pronto (`textoDoTemplate` + `preencherTemplate`). Lembrete de onboarding pausado, cancelado ou concluído, ou de quem pediu opt-out, não entra na fila.
- **Motivo:** escolhas do PO no planejamento e na S5-2; o desenho repete o do calendário (estado no banco + reserva), que dá a mesma garantia de uma fila sem Redis nesta fase.
- **Substitui:** a versão anterior deste arquivo (planejamento).
