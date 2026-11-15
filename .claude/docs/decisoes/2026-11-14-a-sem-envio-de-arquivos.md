# Sem envio de arquivos pelo link do cliente

- **Data / trilha:** 2026-11-14 / A
- **Pedido do PO:** no onboarding, anexar logo e arquivos é desnecessário; o storage de arquivos também.
- **Decisão:**
  - O tipo de pergunta "Envio de arquivo" (`upload`) deixou de existir (RN-16 revisada). A agência não consegue mais criar essa pergunta, e o modelo padrão perdeu "Logo da empresa" e "Manual de marca".
  - Removidos o módulo `uploads` (rotas de envio pelo link e de download no painel), a porta `Armazenamento` (`@convergia/core/uploads`), os adaptadores de storage, a variável `ARMAZENAMENTO_DIR` e a dependência `@fastify/multipart`.
  - Banco (migração `remover_envio_de_arquivos`): sai a tabela `arquivos` e os campos `uploadTamanhoMaxMb`/`uploadTiposPermitidos` de `ConfigAgencia`. A migração também tira as perguntas do tipo `upload` das versões e rascunhos de formulário já guardados, e o valor delas nas respostas, para nenhuma tela encontrar um tipo que não existe mais.
  - Painel: o detalhe do onboarding perdeu a seção "Arquivos". A exportação LGPD perdeu a lista de arquivos, e a exclusão devolve só `{ onboardings }`.
  - O termo de consentimento ainda cita "dados e arquivos". O texto não mudou para não obrigar quem já aceitou a aceitar de novo; o PO decide se ajusta.
- **Consequência:** não há mais adaptador S3 a escolher no go-live (pendência herdada da Sprint 2 encerrada).
- **Substitui:** `2026-11-15-a-upload-arquivos.md`.
