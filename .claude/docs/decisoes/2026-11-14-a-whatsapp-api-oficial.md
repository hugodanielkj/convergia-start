# WhatsApp pela API oficial da Meta (Cloud API)

- **Data / trilha:** 2026-11-14 / A
- **Decisão (PO):** migrar o WhatsApp de produção da MegaAPI (D-07) para a API oficial da Meta. A MegaAPI continua disponível para desenvolvimento.
- **Decisão (técnica):**
  - Novo adaptador `apps/api/src/adapters/mensageria/whatsapp-meta.ts` na mesma porta `Mensageria` (RN-71). Nenhuma regra de negócio mudou.
  - Escolha do provedor por `WHATSAPP_PROVEDOR` (`megaapi`, padrão, ou `meta`). Sem credenciais, o WhatsApp fica pendente e sai quando configurar (RN-60).
  - Envio: `POST https://graph.facebook.com/<versão>/<PHONE_NUMBER_ID>/messages` com `Bearer <token>`, sem SDK.
  - **Templates (RN-61):** a empresa só pode iniciar conversa com template aprovado. O app guarda o texto já preenchido (as variáveis se perdem ao enfileirar), então cada template da Meta tem **uma variável `{{1}}` com o texto completo** da mensagem. O tipo da notificação (`convite`, `confirmacao_prazo`, `lembrete_pendencia`, `lembrete_compromisso`) escolhe o template pelo mapa `META_WHATSAPP_TEMPLATES` (`tipo=nome,tipo=nome`); tipo fora do mapa usa `META_WHATSAPP_TEMPLATE_PADRAO`; sem nenhum dos dois, falha definitiva (vai para o e-mail). A Meta não aceita quebra de linha no parâmetro: o adaptador troca por espaço (limite de 1024 caracteres). Por isso o texto no WhatsApp sai em um parágrafo só. Para sair formatado, o passo futuro é guardar as variáveis na notificação e usar um parâmetro por variável.
  - Contrato novo (opcional, compatível): `MensagemSaida.tipo` em `core/base/mensageria.ts`, preenchido pelo worker.
  - **Erros:** temporários = HTTP 408/429/5xx e códigos Meta 1, 2, 4, 17, 341, 80007, 130429, 131016, 131056 (retentativa). Definitivos = o resto (número sem WhatsApp 131026, fora da janela 131047, template inexistente 132001, parâmetro errado 132000, token 190...) e vão para o e-mail.
  - Variáveis (`.env`): `WHATSAPP_PROVEDOR`, `META_WHATSAPP_TOKEN` e `META_WHATSAPP_PHONE_NUMBER_ID` (juntas), `META_WHATSAPP_API_VERSION` (padrão `v21.0`), `META_WHATSAPP_IDIOMA` (padrão `pt_BR`), `META_WHATSAPP_TEMPLATES`, `META_WHATSAPP_TEMPLATE_PADRAO`. O token nunca vai para log nem para o erro gravado.
  - Webhook `GET/POST /publico/webhooks/meta-whatsapp` (só existe com `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` e `META_APP_SECRET`, juntas): GET devolve o challenge; POST exige `X-Hub-Signature-256` (HMAC SHA-256 do corpo cru com o app secret, tempo constante). Entrega `failed` de mensagem já `enviada` vira `falhou` e publica `notificacao.falhou`; "PARAR" (parar, pare, sair, stop, cancelar, descadastrar) desativa os lembretes do telefone (RN-61). `delivered`/`read` são ignorados (não há coluna para isso). Limite: telefone brasileiro sem o 9º dígito no retorno da Meta não casa com o cadastro.
- **Plano de migração:** (1) PO cria tudo na Meta (abaixo); (2) coloca as variáveis no ambiente de teste com seu próprio número, mantém `megaapi` em produção; (3) envia um convite de teste; (4) troca `WHATSAPP_PROVEDOR=meta`; (5) a MegaAPI fica de reserva e, depois de uma semana sem problemas, é desligada.
- **Motivo:** risco de banimento do número não oficial; D-07 já previa trocar só o adaptador.

## Passo a passo para o PO

1. **Conta Meta Business:** em business.facebook.com crie o portfólio da empresa e faça a **verificação do negócio** (CNPJ e documentos; leva dias).
2. **WhatsApp Business Platform:** em developers.facebook.com crie um app do tipo "Empresa", adicione o produto **WhatsApp** e cadastre o número (precisa receber SMS/ligação; não pode estar em uso no WhatsApp comum). Anote o **ID do número de telefone** → `META_WHATSAPP_PHONE_NUMBER_ID`.
3. **Token permanente:** no Gerenciador de Negócios, Configurações → Usuários do sistema → crie um usuário (Admin), atribua o app e a conta do WhatsApp, gere o token com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`, sem expiração → `META_WHATSAPP_TOKEN`. Guarde só no `.env`/cofre.
4. **Templates:** em WhatsApp Manager → Modelos de mensagem, crie 4 modelos, categoria **Utilidade**, idioma **Português (BR)**, corpo com uma variável `{{1}}` (exemplo de valor: "Olá Maria! Seu link: https://..."). Nomes sugeridos e textos:
   - `convergia_convite`: "Olá! Você tem uma mensagem sobre o seu onboarding: {{1}}"
   - `convergia_confirmacao`: "Confirmação do seu onboarding: {{1}}"
   - `convergia_lembrete_pendencia`: "Lembrete do seu onboarding: {{1}}"
   - `convergia_lembrete_compromisso`: "Lembrete de compromisso: {{1}}"
     Depois da aprovação, configure `META_WHATSAPP_TEMPLATES=convite=convergia_convite,confirmacao_prazo=convergia_confirmacao,lembrete_pendencia=convergia_lembrete_pendencia,lembrete_compromisso=convergia_lembrete_compromisso`. Dica: a Meta pode recusar modelo que seja só a variável; mantenha o texto fixo em volta.
5. **Opt-in:** só envie a quem aceitou receber (o termo do onboarding cobre; mantenha o link "parar lembretes" nos lembretes).
6. **Webhook:** em WhatsApp → Configuração, informe a URL `https://<sua-api>/publico/webhooks/meta-whatsapp`, um token de verificação inventado por você (`META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`), coloque o App Secret (Configurações do app → Básico) em `META_APP_SECRET` e assine o campo `messages`.
7. **Testar:** `WHATSAPP_PROVEDOR=meta`, reinicie a API, crie um onboarding com seu WhatsApp e envie o convite; veja a notificação `enviada` na tabela `notificacoes` (coluna `idExterno` começa com `wamid.`). Em modo de teste da Meta, só números cadastrados como destinatários de teste recebem.
