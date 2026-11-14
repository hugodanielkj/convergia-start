# Proteções do link público: limite, cabeçalhos e CSRF (RN-76)

- **Data / trilha:** 2026-11-14 / A
- **Decisão:**
  - **Limite de requisições** só nas rotas `/publico/*`, em três contadores de janela fixa: por IP, por token (guardado como hash) e tokens errados (404) por IP. Quem passa do limite recebe 429 com `Retry-After`. Os valores vêm de variáveis de ambiente (`LIMITE_*`), com padrão.
  - **Contadores em memória**, atrás de uma porta (`ContadorJanela`). O MVP roda uma instância da API. Com mais de uma, troca-se a implementação pela do Redis (já no `docker-compose`), sem mexer nas regras. Assim não entra dependência nova agora.
  - **IP do cliente:** a API confia no `X-Forwarded-For` só quando a conexão vem de um proxy confiável (`CONFIAR_PROXY`, padrão: rede local e privada). A web repassa o `X-Forwarded-For` nas chamadas que faz do servidor para as rotas públicas. Chamadas internas sem IP do cliente (sem o cabeçalho, vindas da rede privada) só contam por token. **Em produção, um proxy na frente da web precisa gravar o `X-Forwarded-For`**; sem ele, o IP pode ser forjado e só o limite por token vale.
  - **CSRF por origem** (recomendação OWASP para APIs sem formulário de terceiros): POST, PUT, PATCH e DELETE com `Sec-Fetch-Site` diferente de `same-origin`/`none`, ou com `Origin` diferente de `APP_URL`, recebem 403. Sem nenhum dos dois cabeçalhos (chamadas de servidor, testes), passa. O cookie de sessão continua `SameSite=Lax` e `httpOnly`.
  - **Cabeçalhos:** a API responde só JSON e arquivos, então a CSP dela é fechada (`default-src 'none'; sandbox`), o que também impede um arquivo enviado de rodar script. A web usa CSP com nonce gerado no `proxy.ts` do Next (todas as páginas já são dinâmicas). HSTS só em produção.
- **Motivo:** o token já tem 256 bits, então adivinhar é inviável; o limite tira a chance de abuso e protege o banco. Origem é a forma mais simples de CSRF sem mudar as chamadas das etapas das duas trilhas.
- **Substitui:** —
