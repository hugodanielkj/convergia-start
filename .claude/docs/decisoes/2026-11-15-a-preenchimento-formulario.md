# Preenchimento do formulário pelo cliente (S2-3)

- **Data / trilha:** 2026-11-15 / A
- **Decisão:**
  - Respostas ficam em `respostas_formulario` (uma por onboarding), **presas à versão do modelo vigente quando o cliente começou** (RN-15). Se a agência publicar outra versão depois, quem já começou continua na antiga; clientes novos pegam a nova.
  - **Rascunho (RN-18):** a página salva sozinha ~1 s depois da última digitação (`PUT .../formulario/rascunho`), valida só o formato e põe a etapa em `em_andamento`. Reabrir o link devolve o que foi salvo.
  - **Envio (RN-17):** `POST .../formulario/enviar` exige todos os obrigatórios ativos preenchidos e válidos; só então a etapa vira `concluida`. A validação é feita no `core` (`validarRespostas`), por tipo de campo (RN-16).
  - **Edição depois do envio (RN-21):** permitida pelo mesmo envio, com todas as regras de novo. Cada edição é auditada com **só os nomes dos campos alterados, nunca o conteúdo** (minimização). Reenviar sem mudar nada não audita.
  - **"Fechada" (RN-21):** não existia na spec como status de etapa. Criei a coluna `fechadaEm` e a rota da agência `POST /onboardings/:id/formulario/fechar` (Admin ou responsável). A edição também fecha quando a etapa `reuniao` fica `concluida`. **A tela da agência com o botão "Fechar" fica para a S4-2** (detalhe do onboarding).
  - O formulário só abre depois do aceite do termo (RN-72); sem aceite, a API responde 409.
  - Upload pelo link: `POST /publico/onboardings/:token/arquivos` (mesma validação da S2-4, ator `cliente:<id>`). Cada arquivo citado na resposta precisa existir e ser do mesmo cliente.
- **Contrato para a trilha B:** a etapa `reuniao` com status `concluida` fecha a edição do formulário (RN-21). Se a trilha B marcar a reunião como realizada de outro jeito, avisar.
- **Motivo:** o cliente não perde o que preencheu e a agência mantém o histórico por versão.
