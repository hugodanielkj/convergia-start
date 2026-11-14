# Sprint 1 — Cadastro e link único

**Status:** aprovada pelo PO em 2026-11-13. Pronta para implementar, começando pela S1-1.

**Objetivo:** a agência entra no sistema, cadastra um cliente novo e recebe o link único de onboarding dele, com segurança e isolamento de dados.

**Demonstração ao PO (local, no navegador do app, D-20):** login com Google → novo cliente → ver o cliente na lista com o link para copiar → abrir o link (página provisória) → regenerar o link e ver o antigo parar de funcionar.

## Histórias

| ID   | História                                | Critérios de aceite                                                                                                                                                                                                     | Modelo / esforço |
| ---- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S1-1 | Schema do banco + seed + Postgres na CI | Migrações aplicam em banco limpo; seed cria a agência, a configuração com os padrões de D-09 e o usuário admin; teste de integração prova que consultas filtram por `agencia_id` (RN-75).                               | Sonnet / médio   |
| S1-2 | Login da equipe e papéis                | "Entrar com Google" (D-21); só e-mails cadastrados e ativos entram; sessão em cookie seguro; só admin altera configurações (RN-03); membro só vê onboardings dos quais é responsável (RN-02); login e logout auditados. | Opus / alto      |
| S1-3 | Cadastro de cliente                     | Exige empresa, contato e WhatsApp **ou** e-mail válidos (RN-04); telefone normalizado em E.164 com DDI 55 (RN-05); alerta de duplicidade por e-mail/telefone antes de criar (RN-07); lista simples de clientes.         | Sonnet / médio   |
| S1-4 | Onboarding criado automaticamente       | Criar cliente cria 1 onboarding com 4 etapas `pendente` (RN-06), na mesma transação; responsável padrão é o admin (RN-08); bloqueia segundo onboarding ativo (RN-07); criação auditada (RN-77).                         | Sonnet / médio   |
| S1-5 | Link único com expiração e regeneração  | Token de 256 bits guardado só como hash (RN-10, D-13); expira em `validade_link_dias` com página amigável (RN-11); regenerar invalida o anterior na hora (RN-12); link só expõe o próprio onboarding (RN-13).           | Sonnet / médio   |

**Fora desta sprint:** envio automático do convite (RN-09) depende das notificações (Sprint 6). Até lá, a agência copia o link e envia manualmente. A tela de resumo pós-conclusão (RN-14) entra com a página do cliente na Sprint 2.

## Decisões

- D-20: `hml` é a branch principal durante o desenvolvimento; sem ambiente publicado. S1-6 removida.
- D-21: login com Google, só e-mails cadastrados.
- D-22: única usuária é a dona da agência (admin); sem tela de equipe.
- D-23: convite enviado manualmente ("Copiar link") até a Sprint 6.

## Entregue

## Retro
