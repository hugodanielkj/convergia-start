# Acessos por parceiro: aviso do cliente, confirmação da agência (S3-1, S3-2)

- **Regras:** RN-22, RN-27, RN-28, RN-29, D-05, D-06.
- **Cliente avisa, agência confirma.** O sistema não consegue verificar se a agência foi adicionada no Meta/TikTok/Google. O cliente clica "Já adicionei a agência" (status continua `pendente`, mas a etapa vai para "em andamento") e só a agência marca `concedido`.
- **Inválido:** exige motivo (até 500 caracteres); o cliente vê o motivo e, ao reinformar, volta a `pendente`. Marcar `concedido` não precisa de motivo. A notificação ao cliente (RN-28) fica para a Sprint 5 (mensageria); por ora ele vê o aviso na página.
- **Etapa:** recalculada a cada leitura/mudança (`etapaAcessos` no core). Obrigatórias vêm de `plataformasObrigatorias` da config (Instagram e Facebook por padrão). Marcar inválido depois de concluída reabre a etapa.
- **Identificador da agência (RN-22):** tabela própria `config_acessos` (um texto por plataforma), editada pelo admin em `/config/acessos`. Não mexi em `ConfigAgencia` para não criar PR de contrato. Sem identificador, o passo a passo manda o cliente pedir à agência.
- **Sem senha (D-05, RN-29):** nenhuma tela ou rota aceita credencial; o texto do cliente avisa para nunca enviar senha por mensagem.
- **Permissão:** só admin ou responsável marcam acessos (RN-02); tudo escopado por agência (RN-75). Cliente, agência e config auditados (RN-77).
