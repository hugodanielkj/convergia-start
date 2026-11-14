# Sprint 1 — Base compartilhada, login e cadastro

**Status:** concluída em 2026-11-14 (trilhas A e B na `hml`). Aprovada pelo PO em 2026-11-13, reorganizada em duas trilhas (D-24).

**Objetivo:** a agência entra no sistema, cadastra um cliente novo e recebe o link único de onboarding dele, com segurança e isolamento de dados.

**Demonstração ao PO (local, no navegador do app, D-20):** login com Google → novo cliente → ver o cliente na lista com o link para copiar → abrir o link (página provisória) → regenerar o link e ver o antigo parar de funcionar.

## Ordem

1. **Trilha A faz a S1-1 primeiro.** Enquanto isso, a trilha B adianta as regras puras de cadastro em `packages/core/src/clientes` (validação e normalização de telefone e e-mail, RN-04, RN-05), que não dependem do banco.
2. Depois do merge da S1-1 na `hml`, as duas trilhas seguem em paralelo.

## Trilha A — PO

| ID   | História                  | Critérios de aceite                                                                                                                                                                                                                                                                                                                                                                                                                                     | Modelo / esforço |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S1-1 | Base compartilhada        | Prisma com schema em vários arquivos (`prisma/schema/base.prisma`: agência, usuário, config, auditoria); seed com a agência, padrões de D-09 e admin (e-mail via env); Postgres na CI e testes `*.int.test.ts`; consultas filtram por `agencia_id` (RN-75); autoload de módulos na API; subcaminhos em `core`; contratos de auth (`exigirUsuario`), eventos de domínio e mensageria; casca do painel e da página do cliente com as 4 etapas como stubs. | Opus / alto      |
| S1-2 | Login com Google e papéis | "Entrar com Google" (D-21); só e-mails cadastrados e ativos entram; sessão em cookie seguro; só admin altera configurações (RN-03); membro só vê onboardings dos quais é responsável (RN-02); login e logout auditados.                                                                                                                                                                                                                                 | Opus / alto      |

## Trilha B — colaborador

| ID   | História                               | Critérios de aceite                                                                                                                                                                                             | Modelo / esforço |
| ---- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S1-3 | Cadastro de cliente                    | Exige empresa, contato e WhatsApp **ou** e-mail válidos (RN-04); telefone normalizado em E.164 com DDI 55 (RN-05); alerta de duplicidade por e-mail/telefone antes de criar (RN-07); lista simples de clientes. | Sonnet / médio   |
| S1-4 | Onboarding criado automaticamente      | Criar cliente cria 1 onboarding com 4 etapas `pendente` (RN-06), na mesma transação; responsável padrão é o admin (RN-08); bloqueia segundo onboarding ativo (RN-07); criação auditada (RN-77).                 | Sonnet / médio   |
| S1-5 | Link único com expiração e regeneração | Token de 256 bits guardado só como hash (RN-10, D-13); expira em `validade_link_dias` com página amigável (RN-11); regenerar invalida o anterior na hora (RN-12); link só expõe o próprio onboarding (RN-13).   | Sonnet / médio   |

As rotas da trilha B usam o contrato `exigirUsuario` da S1-1; nos testes, um usuário fake. Não dependem da S1-2 estar pronta.

**Fora desta sprint:** envio automático do convite (RN-09) fica para a S5-4 (D-23). A tela de resumo pós-conclusão (RN-14) fica para a S6-2.

## Decisões

- D-20: `hml` é a branch principal durante o desenvolvimento; sem ambiente publicado.
- D-21: login com Google, só e-mails cadastrados.
- D-22: única usuária é a dona da agência (admin); sem tela de equipe.
- D-23: convite enviado manualmente ("Copiar link") até a Sprint 5.
- D-24: duas trilhas paralelas com posse de pastas.

## Entregue

### Trilha A

### Trilha B

- **Cadastro de cliente (S1-3):** a agência cadastra empresa e contato com WhatsApp ou e-mail; o telefone vira o padrão internacional e o e-mail vai para minúsculas. Se o e-mail ou o WhatsApp já existirem, o sistema avisa antes de criar e só grava se a agência confirmar. Lista de clientes com status e etapas.
- **Onboarding automático (S1-4):** cada cliente novo nasce com o onboarding e as quatro etapas pendentes, tendo o Admin como responsável. Um cliente nunca tem dois onboardings ativos, nem com dois cliques ao mesmo tempo.
- **Link único (S1-5):** cada onboarding tem um link que só o cliente conhece, com validade configurável. A agência gera um novo link a qualquer momento e o anterior deixa de funcionar na hora. Link expirado mostra uma página amigável e o cliente pode pedir um novo.

**Não entregue:** nada da trilha B ficou para trás. O envio automático do convite continua para a S5-4 (D-23).

## Retro

### Trilha A

### Trilha B

- **Manter:** (1) regras puras em `core` primeiro, antes de existir banco, com testes citando a RN; (2) testes de integração com banco real, incluindo isolamento entre duas agências; (3) conferir a tela no navegador contra a API de verdade antes de abrir o PR.
- **Melhorar:** (1) `base.prisma` e `backlog.md` geram conflito quando as duas trilhas mesclam no mesmo dia, então avisar a outra trilha antes de mexer neles; (2) as imagens Docker da CI levam mais que o resto, o que atrasa o merge; (3) um arquivo do projeto (`.claude/launch.json`) já existia e foi sobrescrito por engano uma vez, então conferir `git status` antes de criar arquivos em `.claude/`.
- **Achados para a trilha A:** o botão "Sair" do painel responde 415 (formulário comum não é aceito pela API) e a página do cliente precisa mandar para `/o/<token>/expirado` ao receber 410.
