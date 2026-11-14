---
paths:
  - 'apps/api/**'
  - 'apps/web/app/o/**'
  - 'prisma/**'
---

# Segurança e LGPD

- Segredos só em variáveis de ambiente; nunca no código, em logs ou em fixtures commitadas. `.env` não é versionado; documente variáveis em `.env.example`.
- Token do link: 256 bits (`crypto.randomBytes(32)`), armazenado como hash SHA-256, comparado em tempo constante (RN-10, D-13).
- A rota pública do cliente (`/o/:token`) só expõe dados daquele onboarding (RN-13). Respostas de erro não revelam se um token existe.
- Nunca pedir ou registrar senha de rede social (D-05, RN-29).
- Logs sem dados pessoais completos: mascarar e-mail, telefone e conteúdo de formulário.
- Auditar: criação/edição de cliente, mudança de status, ajuste de prazo, regeneração de link (RN-77).
- Uploads: validar tipo real (magic bytes) e tamanho no servidor (RN-20).
