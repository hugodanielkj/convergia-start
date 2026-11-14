# Página do cliente: primeiro acesso e consentimento (S2-1)

- **Data / trilha:** 2026-11-15 / A
- **Decisão:**
  - **RN-50:** a página chama `POST /publico/onboardings/:token/abrir`. A primeira chamada grava data/hora em `primeiros_acessos` (chave única, então aberturas simultâneas contam uma só), muda `criado`/`convite_enviado` para `em_andamento` e audita como `cliente:<onboardingId>`. Link inválido, expirado ou cancelado não registra nada.
  - **RN-72:** o termo vive em `@convergia/core/consentimento` (`TERMO_ATUAL`, com versão por data). O cliente só vê as etapas depois de aceitar. O aceite grava data, hora e versão em `consentimentos_cliente`; repetir não duplica. Aceite de versão antiga é recusado (409). Não guardamos IP nem dispositivo (minimização, RN-73).
  - `onboardingId` nas duas tabelas é coluna simples, sem relação, para não alterar o módulo onboarding (trilha B).
  - Se o termo mudar de versão no futuro, o cliente que já aceitou a antiga verá o novo termo de novo no próximo acesso.
  - O progresso mostra as etapas `concluida` reais; as etapas em si seguem como stubs até a S2-3 (formulário), S3-1 (acessos) e trilha B.
  - Texto do termo ainda é padrão do sistema, não editável pela agência (fica para depois do MVP, se o PO quiser).
- **Contrato para a trilha B:** nenhum novo. Usei `localizarLink` do módulo link (somente leitura).
- **Motivo:** LGPD no primeiro acesso e início do andamento sem depender de ação da agência.
