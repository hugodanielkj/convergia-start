# Sprint 1 — Cadastro e link único

**Status:** proposta, aguardando respostas do PO (seção Perguntas).

**Objetivo:** a agência entra no sistema, cadastra um cliente novo e recebe o link único de onboarding dele, com segurança e isolamento de dados.

**Demonstração ao PO (em `hml`):** login → novo cliente → ver o cliente na lista com o link para copiar → abrir o link (página provisória) → regenerar o link e ver o antigo parar de funcionar.

## Histórias

| ID   | História                                        | Critérios de aceite                                                                                                                                                                                             | Modelo / esforço |
| ---- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S1-1 | Schema do banco + seed + Postgres na CI         | Migrações aplicam em banco limpo; seed cria a agência, a configuração com os padrões de D-09 e o usuário admin; teste de integração prova que consultas filtram por `agencia_id` (RN-75).                       | Sonnet / médio   |
| S1-2 | Login da equipe e papéis                        | Só e-mails cadastrados e ativos entram; sessão em cookie seguro; só admin altera configurações (RN-03); membro só vê onboardings dos quais é responsável (RN-02); login e logout auditados.                     | Opus / alto      |
| S1-3 | Cadastro de cliente                             | Exige empresa, contato e WhatsApp **ou** e-mail válidos (RN-04); telefone normalizado em E.164 com DDI 55 (RN-05); alerta de duplicidade por e-mail/telefone antes de criar (RN-07); lista simples de clientes. | Sonnet / médio   |
| S1-4 | Onboarding criado automaticamente               | Criar cliente cria 1 onboarding com 4 etapas `pendente` (RN-06), na mesma transação; responsável padrão é o admin (RN-08); bloqueia segundo onboarding ativo (RN-07); criação auditada (RN-77).                 | Sonnet / médio   |
| S1-5 | Link único com expiração e regeneração          | Token de 256 bits guardado só como hash (RN-10, D-13); expira em `validade_link_dias` com página amigável (RN-11); regenerar invalida o anterior na hora (RN-12); link só expõe o próprio onboarding (RN-13).   | Sonnet / médio   |
| S1-6 | Ambiente de homologação (depende da pergunta 4) | Push em `hml` publica automaticamente api, web e banco; PO acessa por uma URL; segredos fora do repositório.                                                                                                    | Sonnet / médio   |

**Fora desta sprint:** envio automático do convite (RN-09) depende das notificações (Sprint 6). Até lá, a agência copia o link e envia manualmente. A tela de resumo pós-conclusão (RN-14) entra com a página do cliente na Sprint 2.

## Perguntas ao PO

1. **Login da equipe.** Recomendo **"Entrar com Google"**: sem senha para guardar, e o Google Calendar da Sprint 4 já usa a mesma conta. A alternativa é e-mail e senha. Qual prefere?
2. **Equipe.** Além de você, outras pessoas vão usar o painel agora? Se não, deixo o papel "membro" pronto no sistema, mas a tela de gerenciar equipe fica para depois.
3. **Convite manual até a Sprint 6.** Por enquanto, você copia o link e envia pelo WhatsApp. Aceita?
4. **Onde testar a `hml`.** Para você homologar, o sistema precisa estar publicado na internet. Recomendo o **Railway**: publica sozinho a cada merge em `hml`, já tem Postgres e Redis, e custa em torno de US$ 5–20/mês. A alternativa é rodar no seu computador com Docker, sem custo, mas exige que você rode comandos. Qual prefere? (Se for Railway, você precisa criar a conta.)

## Decisões

- (preencher após as respostas)

## Entregue

## Retro
