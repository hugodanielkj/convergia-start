# Sprint 8 — Equipe, configurações gerais e teste do fluxo completo

**Status:** em andamento (início 2026-11-19). O PO faz as duas trilhas.

**Objetivo:** a agência funciona sozinha, sem depender do seed: o Admin cadastra a equipe, escolhe o responsável de cada cliente e ajusta prazos e regras em tela. Um teste automático percorre o fluxo feliz inteiro antes do piloto.

**Ordem:** S8-1 → S8-2 → S7-3. O teste ponta a ponta vem por último para cobrir as telas novas.

| ID   | História                         | Critérios de aceite                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Modelo / esforço |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S8-1 | Cadastro da equipe               | Tela Configurações › Equipe (só Admin, RN-03): lista com nome, e-mail, papel e situação. O Admin cadastra pelo nome, e-mail Google e papel (admin/membro); a pessoa entra com "Entrar com Google" (D-21), sem e-mail de convite. Edita nome e papel; e-mail repetido na agência é recusado. **Desativar:** perde o login na hora (sessões encerradas) e, se tiver onboardings em andamento, o Admin escolhe quem assume (padrão: o próprio Admin). **Reativar** devolve o login. O Admin não desativa nem rebaixa a si mesmo, e a agência nunca fica sem Admin ativo. **Responsável (RN-08):** no Novo cliente, o Admin escolhe numa lista da equipe ativa (sem escolha, fica o Admin); no detalhe do onboarding, o Admin troca o responsável. Tudo auditado (RN-77). Mobile-first a 360px, em `e2e/telas.ts`. | Sonnet / médio   |
| S8-2 | Configurações gerais da agência  | Tela Configurações › Geral (só Admin, RN-03), com os limites aprovados pelo PO (tabela abaixo). Valor fora do limite é recusado com mensagem clara, na tela e na API. A mudança vale daqui para frente: não recalcula prazos nem links que já existem. Em Configurações › Acessos, as plataformas marcadas por padrão (`plataformasObrigatorias`, pelo menos 1, RN-27). Toda alteração auditada com o antes e o depois (RN-77). Mobile-first a 360px, em `e2e/telas.ts`.                                                                                                                                                                                                                                                                                                                                       | Sonnet / médio   |
| S7-3 | Teste ponta a ponta, fluxo feliz | Playwright em `apps/web/e2e/`, a 360px: o Admin cadastra um cliente; o cliente abre o link, aceita o termo e conclui as 4 etapas (formulário, acessos, reunião, captação); o onboarding fica com as 4 etapas `concluida`, o prazo de liberação calculado (RN-43/44), a confirmação gerada para o cliente e o aviso de conclusão na página Avisos (seção 12, critério 1, sem evento de calendário). Roda na CI.                                                                                                                                                                                                                                                                                                                                                                                                 | Sonnet / médio   |

### Limites da tela Geral (aprovados pelo PO)

| Campo                                 | Padrão   | Mín                | Máx           |
| ------------------------------------- | -------- | ------------------ | ------------- |
| Nome da agência                       | —        | 1                  | 80 caracteres |
| Prazo de produção (dias úteis)        | 5        | 1                  | 30            |
| Validade do link (dias)               | 14       | 1                  | 90            |
| Antecedência mínima para agendar (h)  | 24       | 0                  | 168           |
| Intervalo reunião → captação (dias)   | 1        | 0                  | 30            |
| Limite de reagendamentos              | 2        | 0                  | 10            |
| Antecedência para reagendar (h)       | 24       | 0                  | 168           |
| Duração padrão da reunião (min)       | 60       | 15                 | 240           |
| Duração padrão da captação (min)      | 120      | 30                 | 480           |
| Dias sem ação até avisar a agência    | 3        | 1                  | 30            |
| Intervalo mínimo entre reenvios (h)   | 24       | 1                  | 168           |
| Conclusão automática após entrega (d) | 7        | 1                  | 60            |
| Canal padrão                          | WhatsApp | WhatsApp ou e-mail |               |

Ficam de fora: fuso (segue São Paulo), logo e cor, login e senha (`permitirCredenciais` continua desligado). Lembretes e janela de envio já têm tela própria.

## Decisões

- Equipe cadastrada pelo Admin, sem e-mail de convite; quem assume os onboardings de quem sai; responsável escolhido e trocado só pelo Admin: `decisoes/2026-11-19-a-cadastro-equipe.md`.
- Configurações gerais com limites, valendo daqui para frente: `decisoes/2026-11-19-a-configuracoes-gerais.md`.
- Fora desta sprint: "Admin liberar um onboarding para outro membro" (parte final da RN-02); o membro vê só os seus. A homologação com cliente piloto (S7-4) vai para a Sprint 9.
- Modelo: as 3 histórias são de esforço médio (Sonnet recomendado); a sessão roda em Opus, que o PO pode manter ou trocar.

## Entregue

(a preencher)

## Retro

(a preencher)
