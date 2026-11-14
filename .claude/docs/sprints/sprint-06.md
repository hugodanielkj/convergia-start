# Sprint 6 — Personalização por cliente · Ordem guiada · Visual Convergia

**Status:** trilha A concluída (2026-11-14).

## Trilha A — PO

**Objetivo:** depois da conversa com o primeiro cliente, a agência personaliza perguntas e acessos de cada cliente. O cliente segue as etapas em ordem, guiado por botões no topo e avanço automático. O painel mostra o progresso por ícones. Tudo com a cara da Convergia.

**Ordem:** S6-1 → S6-2 → S6-3 → S6-4 → S6-5 → S6-6.

- A S6-4 usa a escolha de plataformas da S6-3 para saber quando os acessos estão feitos.
- A S6-5 usa a regra de liberação da S6-4 para mostrar o cadeado.

| ID   | História                                | Critérios de aceite                                                                                                                                                                                                                                                                                                                                                                                    | Modelo / esforço |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| S6-1 | Tokens visuais e fontes (PR `chore/`)   | Tokens da Convergia em `globals.css`, com os antigos apontando para eles. Fraunces nos títulos (peso 500) e Arial/Helvetica no texto. Modo escuro mantido. Contraste AA.                                                                                                                                                                                                                               | Sonnet / médio   |
| S6-2 | Perguntas personalizadas por cliente    | Em `/clientes/novo`, a seção "Personalizar dados da empresa" parte do modelo padrão e permite adicionar, remover e editar perguntas só para esse cliente. A mesma edição existe em `/onboardings/[id]/personalizar`. Cada vez que salva, cria uma versão própria do cliente, e a resposta fica presa a ela (RN-15). Trava no primeiro rascunho com resposta (409). O modelo padrão não muda. Auditado. | Opus / alto      |
| S6-3 | Acessos escolhidos por cliente          | A seção "Personalizar acessos" vem com as plataformas marcadas pela config, e qualquer uma pode ser desmarcada, mas é preciso ficar com pelo menos 1. O cliente só vê as escolhidas. A etapa conclui quando todas as escolhidas estão concedidas (RN-27). Trava quando a etapa começa. Sem login nem senha. Auditado.                                                                                  | Opus / alto      |
| S6-4 | Ordem guiada na página do cliente       | Barra de progresso e 4 botões no topo, uma etapa por vez. Liberação sequencial (RN-79): formulário enviado → Acessos; avisou em todas as plataformas → Reunião; reunião agendada → Captação. Uma etapa bloqueada abre só para leitura, com alerta, e o servidor recusa ações nela. Ao concluir uma etapa, o cliente vai sozinho para a próxima, pelo contrato `useAvancoEtapa`.                        | Opus / alto      |
| S6-5 | Progresso por ícones em `/onboardings`  | No lugar de "X de 4", 4 ícones: ✓ verde = concluída, laranja = em andamento, cinza = pendente, cadeado = bloqueada. Cada ícone tem nome acessível e tooltip.                                                                                                                                                                                                                                           | Sonnet / médio   |
| S6-6 | Novo visual no painel e na página do CA | As telas do painel e do cliente seguem os tokens da S6-1: menos texto, mais visual e mobile-first. As telas da trilha B só mudam por CSS.                                                                                                                                                                                                                                                              | Sonnet / médio   |

## Decisões (trilha A)

- Perguntas por cliente com versões próprias e trava no primeiro rascunho: `decisoes/2026-11-14-a-formulario-por-cliente.md`.
- Plataformas escolhidas por cliente, com pelo menos uma: `decisoes/2026-11-14-a-acessos-por-cliente.md`.
- Login e senha fora do sistema, sem RN-23 a RN-26: `decisoes/2026-11-14-a-sem-credenciais.md`.
- Liberação sequencial, contrato de avanço e bloqueio no servidor: `decisoes/2026-11-14-a-liberacao-sequencial.md`.
- Tokens, fontes e ícones de progresso: `decisoes/2026-11-14-a-visual-convergia.md`.

### Pastas da trilha B tocadas (mínimo, avisar o colaborador)

- `app/(painel)/clientes`: as seções de personalização no cadastro e o atalho "Personalizar" no cartão.
- `modulos/agenda` e `modulos/captacao`: uma chamada a `exigirEtapaLiberada` antes de reservar.
- `_etapas/reuniao` e `_etapas/captacao`: uma chamada a `avancar()` depois de agendar, além de ajustes de CSS.

## Entregue

### Trilha A

As 6 histórias foram mergeadas na `hml` com CI verde.

- **S6-1:** tokens da marca e Fraunces (#46). Estilos base com `:where()` (#50).
- **S6-2:** perguntas por cliente com versões próprias, trava no primeiro rascunho com resposta e tela `/onboardings/[id]/personalizar` (#47).
- **S6-3:** plataformas escolhidas por cliente, com pelo menos uma e trava quando a etapa começa (#48).
- **S6-4:**
  - liberação sequencial (RN-79) no core e no servidor, com 422 `RN-79`;
  - botões das etapas no topo, uma etapa por vez;
  - etapa bloqueada só para leitura, com alerta;
  - avanço automático pelo contrato `useAvancoEtapa` (#49).
- **S6-5:** ícones de progresso em `/onboardings`, com o cadeado calculado pela RN-79.
- **S6-6:** painel com topo petrol e marca em Fraunces, cores e raios por token, cartões e selos da página do cliente, ações rápidas em contorno e menos texto em Acessos.

## Retro

### Trilha A

- **Funcionou:**
  - As regras novas ficaram puras no core (`formulario/personalizacao`, `acessos/escolha`, `liberacao`) e foram testadas sem banco.
  - O contrato de avanço deixou a mudança na reunião (trilha B) em 1 linha.
- **Atenção:**
  - O bloqueio no servidor quebrou 62 testes de integração da trilha B, que agendavam sem cumprir as etapas. Foi resolvido com o helper `liberarAteReuniao`, mas o colaborador precisa usá-lo nos testes novos.
  - Como as histórias foram encadeadas em branches, cada merge na `hml` pediu um merge de volta, com conflitos de "adicionado nos dois lados".
- **Pendências:**
  - A personalização é uma foto do modelo padrão: se a agência publicar uma versão nova, os clientes já personalizados não mudam (decisão registrada).
  - A tela `/config` continua 404.

## Trilha B — colaborador

(a trilha B segue com S5-3 e S5-4)
