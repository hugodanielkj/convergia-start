# Registro de decisões

Formato: `D-xx — data — decisão. Motivo.` Decisões novas no fim. Para mudar uma decisão, crie outra que a substitua.

## Produto (respostas do PO, 2026-11-13)

- **D-01** — Uma única agência usa o sistema (single-tenant na prática). Tabelas mantêm `agencia_id` para permitir SaaS no futuro (RN-75), mas não há telas de cadastro de agência nem planos.
- **D-02** — O dono da agência faz todas as captações; há um único profissional com agenda. Disponibilidade de reunião e captação é dele.
- **D-03** — Captações são presenciais (local obrigatório, RN-40). **Reuniões são online**, com link do Google Meet gerado pelo Google Calendar (RN-34).
- **D-04** — Calendário: Google Calendar (RN-67).
- **D-05** — Acessos somente por permissão/parceiro (Meta Business Manager e equivalentes). **Login e senha não são aceitos no MVP**; RN-23 a RN-26 ficam fora do MVP.
- **D-06** — Plataformas obrigatórias: Instagram e Facebook. Opcionais: TikTok e Google (RN-27).
- **D-07** — WhatsApp via **MegaAPI** (provedor não oficial), atrás de adaptador (RN-71). Risco de banimento do número aceito pelo PO; trocar pela API oficial da Meta exige só um novo adaptador.
- **D-08** — MVP não inclui aprovação nem agendamento de posts (Fase 2).
- **D-09** — Valores ainda não definidos pela agência usam os padrões da spec, todos configuráveis: prazo de produção 5 dias úteis, link válido 14 dias, antecedência mínima 24h, 2 reagendamentos, lembretes D+1/D+3/D+5, janela de envio 08h–20h sem domingos, formulário do RN-19.

## Técnicas

- **D-10** — Monorepo pnpm: `packages/core` (regras de negócio puras, sem I/O), `apps/api` (Fastify), `apps/web` (Next.js). Pacotes internos expõem `src` via condição `source` em dev/testes e `dist` em produção.
- **D-11** — PostgreSQL + Prisma. Overbooking (RN-33) impedido por restrição de exclusão (`tstzrange`) no banco, não só no código.
- **D-12** — Integrações (WhatsApp, e-mail, calendário, storage) acessadas apenas por interfaces em `core`; implementações em `apps/api/src/adapters` (RN-71).
- **D-13** — Token do link do cliente: 256 bits aleatórios, armazenado só como hash SHA-256 (RN-10).
- **D-14** — Datas em UTC no banco; dias úteis calculados no fuso da agência (`America/Sao_Paulo`).
- **D-15** — Node 24 (LTS) na CI e nas imagens Docker.
- **D-16** — TypeScript fixado em `~6.0`: `typescript-eslint` ainda não suporta TS 7. Rever quando houver suporte (Dependabot ignora major de `typescript`).
- **D-17** — Imagens Docker: build multi-stage, usuário não-root; API via `pnpm deploy --legacy`, web via `output: 'standalone'` do Next.
- **D-18** — CI (GitHub Actions) bloqueia merge se falhar: formatação, lint (typed, `strictTypeChecked`), typecheck, testes com cobertura mínima, build, `pnpm audit` (high) e build das imagens Docker.
- **D-19** — 2026-11-13 — Branches `feat/*` → `hml` → `main`. Claude faz merge em `hml` com CI verde; merge em `main` só com aprovação do PO. A CI roda igual em PRs e em push para `main` e `hml`.

## Sprint 1 (respostas do PO, 2026-11-13)

Contexto: o PO desenvolve o sistema para uma cliente, a dona da agência. Ela é a usuária do painel. Os clientes dela (empresas) nunca fazem login (RN-01).

- **D-20** — Durante o desenvolvimento, `hml` é a branch principal: Claude faz merge nela com CI verde. **Não há ambiente publicado nem Docker obrigatório para homologar**; o PO vê as entregas rodando localmente no navegador do app. `main` só recebe o primeiro PR (`hml → main`, aprovado pelo PO) quando o sistema for ao ar com clientes reais. A partir daí, vale D-19 completo. Substitui a história S1-6.
- **D-21** — Login do painel com "Entrar com Google", aceitando só e-mails cadastrados como usuários ativos. A dona da agência já usa Google Calendar (D-04), e a mesma conta servirá para a integração da Sprint 4. O e-mail dela entra por variável de ambiente no seed, nunca no repositório.
- **D-22** — Por enquanto a única usuária do painel é a dona da agência (admin). O papel "membro" existe no modelo (RN-02), mas a tela de gerenciar equipe fica fora do MVP até haver equipe.
- **D-23** — Até a Sprint 6, o convite (RN-09) não é enviado automaticamente: o painel mostra o link com o botão "Copiar link". Sem impacto real, porque o sistema só recebe clientes reais depois do MVP completo.
