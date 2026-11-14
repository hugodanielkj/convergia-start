# Upload de arquivos com validação no servidor (S2-4)

- **Data / trilha:** 2026-11-15 / A
- **Decisão:**
  - O servidor decide o tipo pelo **conteúdo** (primeiros bytes), não pelo nome nem pelo tipo que o navegador informa (RN-20). Reconhece PNG, JPEG, GIF, WebP e PDF; o que não for reconhecido é recusado. A agência escolhe, em `uploadTiposPermitidos`, quais desses vale aceitar, e o tamanho máximo em `uploadTamanhoMaxMb`.
  - Storage atrás da interface `Armazenamento` (`@convergia/core/uploads`). Hoje: pasta local (`ARMAZENAMENTO_DIR`, padrão `.armazenamento`, fora do git). **Em produção entra um adaptador S3 compatível**, escolhido no go-live; não adicionei SDK de S3 agora para não pagar manutenção de uma dependência sem uso.
  - Arquivos ficam em `agencia/cliente/<id>.<ext>` (RN-69). O nome enviado só serve para exibir e nunca vira caminho em disco.
  - Download só pela agência, com `attachment` e `nosniff`.
  - Dependência nova: `@fastify/multipart` (mantida pelo time do Fastify, licença MIT).
  - `Dependencias` ganhou o campo `armazenamento`. Quem monta dependências em teste ganha um fake em memória por padrão.
- **Contrato para a S2-3:** a função `receberArquivo` (`modulos/uploads/receber-arquivo.ts`) será reaproveitada pela rota pública do cliente (com token).
- **Motivo:** impedir que um arquivo perigoso (ex.: HTML disfarçado de imagem) entre, e manter o storage trocável.
