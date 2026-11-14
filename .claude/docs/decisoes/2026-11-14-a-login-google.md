# Login com Google (S1-2)

- **Data / trilha:** 2026-11-14 / A
- **Decisão:**
  - OpenID Connect com `openid-client` (state, nonce e PKCE S256). Verificação guardada em cookie assinado de 10 min.
  - Só entra quem tem e-mail **verificado pelo Google** igual a um usuário ativo, em **uma** única agência. Mensagens de erro genéricas, que não revelam se o e-mail existe.
  - Sessão em tabela `sessoes`, com o **hash SHA-256** do token (o token só existe no cookie `httpOnly`, `SameSite=Lax`, `Secure` quando HTTPS). Duração: `SESSAO_DURACAO_HORAS` (padrão 168h = 7 dias).
  - O navegador só fala com a web: `/api/*` é repassado à API pelo Next (`rewrites`). Cookies no mesmo domínio e sem CORS. URL de retorno do Google: `${APP_URL}/api/auth/google/callback`.
  - Login e logout auditados (RN-77) por `registrarAuditoria`, em `src/base/auditoria.ts`, disponível às duas trilhas.
  - O layout do painel redireciona para `/entrar` sem sessão; a proteção real é a API (`exigirUsuario` em cada rota).
  - Variáveis: `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSAO_SEGREDO` (obrigatório em produção), `SESSAO_DURACAO_HORAS`; na web, `API_URL`. Sem Google configurado, o login responde "indisponível" e `AUTH_DEV_USUARIO_EMAIL` continua valendo para desenvolvimento.
- **Motivo:** D-21; sem senhas guardadas no sistema e com as proteções recomendadas para OAuth em apps web.
