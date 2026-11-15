# Sistema de Onboarding Automatizado para Agências — Regras de Negócio

> Documento de especificação para iniciar o desenvolvimento. Origem: dor real relatada por dona de agência de social media. Pontos marcados como **[CONFIGURÁVEL]** são parâmetros que a agência define; pontos em **Premissas / Perguntas em aberto** devem ser confirmados antes de codar a parte afetada.

---

## 0. Instruções para o Claude (leia primeiro)

1. Leia o documento inteiro antes de escrever código.
2. Construa de forma incremental, seguindo as fases da seção 14 (MVP primeiro). Não implemente itens marcados como "Fora do MVP".
3. Antes de começar, proponha: stack, modelo de dados final e estrutura de pastas. Aguarde aprovação.
4. Toda regra de negócio (RN-xx) deve ter teste automatizado. Cite o ID da regra no nome/comentário do teste.
5. Todo prazo, texto de mensagem e horário de disponibilidade é configurável por agência; nunca deixar valores fixos no código.
6. Em caso de dúvida sobre uma regra, consulte a seção 15 e pergunte, em vez de assumir.
7. Idioma da interface e das mensagens: português do Brasil. Fuso padrão: America/Sao_Paulo.

---

## 1. Visão geral

### 1.1 Problema

Quando um cliente novo fecha com a agência, o início do relacionamento é manual, corrido e confuso. A dona da agência precisa:

- pegar informações de acesso aos perfis do cliente;
- aplicar formulário para conhecer os dados mais importantes da empresa;
- agendar a primeira reunião;
- agendar a primeira captação (foto/vídeo);
- informar o prazo de liberação dos primeiros conteúdos.

Tudo isso acontece de uma vez, assim que o cliente entra, e o cliente está ansioso para ver conteúdo postado logo. Hoje o processo é feito por mensagens soltas, sem lugar único, e gera retrabalho e insegurança.

### 1.2 Objetivo

Centralizar o início do relacionamento em **um único fluxo simples e automático**: ao cadastrar um cliente novo, o sistema envia um link único; o cliente, em uma única página, preenche os dados, configura os acessos e escolhe horários; o sistema agenda tudo, calcula e comunica o prazo de liberação dos primeiros conteúdos, e acompanha pendências automaticamente.

### 1.3 Resultado esperado

- Cliente conclui o onboarding em poucos minutos, sem trocar dezenas de mensagens.
- Agência vê em um painel o status de cada cliente novo e o que falta.
- Nenhum dado, acesso ou data fica perdido em conversas de WhatsApp.

### 1.4 Fora de escopo deste documento

- Fluxo de aprovação de conteúdo e agendamento de posts nas redes (tratado como Fase 2, preferencialmente por integração com ferramenta existente).
- Cobrança, contratos e financeiro.

---

## 2. Atores e permissões

| Ator                           | Descrição                                   | Acesso                                                         |
| ------------------------------ | ------------------------------------------- | -------------------------------------------------------------- |
| **Dono(a) da agência (Admin)** | Configura a agência, cria clientes, vê tudo | Login, acesso total                                            |
| **Membro da equipe**           | Social media, captação etc.                 | Login, vê e atua nos onboardings atribuídos a ele              |
| **Cliente**                    | Empresa contratante                         | **Sem login**: acessa apenas pelo link único do seu onboarding |
| **Sistema**                    | Automações, lembretes, cálculos de prazo    | —                                                              |

**RN-01** — O cliente nunca cria conta. O acesso à página de onboarding é feito exclusivamente por link com token único (ver RN-10).
**RN-02** — Um membro da equipe só vê os onboardings em que é responsável ou os que o Admin liberar.
**RN-03** — Somente o Admin altera configurações da agência (prazos, disponibilidade, templates, integrações).

---

## 3. Glossário

- **Onboarding:** processo de entrada do cliente na agência, do cadastro até a entrega dos primeiros conteúdos.
- **Captação:** sessão de produção de foto/vídeo do cliente.
- **Kickoff / Primeira reunião:** reunião inicial de alinhamento.
- **Prazo de liberação:** data prevista para entrega dos primeiros conteúdos para aprovação/publicação.
- **Etapa:** parte do onboarding com status próprio (formulário, acessos, reunião, captação).
- **Slot:** horário disponível para agendamento.

---

## 4. Modelo de dados (entidades principais)

> Sugestão conceitual. Ajustar tipos e nomes à stack escolhida.

**Agencia**
`id, nome, fuso_horario, logo_url, cor_primaria, criado_em`

**Usuario** (equipe)
`id, agencia_id, nome, email, papel (admin|membro), ativo`

**Cliente**
`id, agencia_id, nome_empresa, nome_contato, email, telefone_whatsapp, segmento, plano/pacote (opcional), criado_em`

**Onboarding**
`id, cliente_id, responsavel_id, status_geral, token_link, token_expira_em, iniciado_em, concluido_em, prazo_liberacao_conteudo (data calculada), observacoes`

**EtapaOnboarding**
`id, onboarding_id, tipo (formulario|acessos|reuniao|captacao), status (pendente|em_andamento|concluida|bloqueada), concluida_em`

**FormularioModelo**
`id, agencia_id, nome, versao, campos (lista ordenada de: rotulo, tipo, obrigatorio, opcoes, ajuda)`

**FormularioResposta**
`id, onboarding_id, modelo_id, versao, respostas (chave→valor), enviado_em`

**AcessoPlataforma**
`id, onboarding_id, plataforma (instagram|facebook|tiktok|google|outro), metodo (business_manager|credencial), status (pendente|concedido|invalido), dados_cifrados (somente se metodo=credencial), concedido_em`

**Agendamento**
`id, onboarding_id, tipo (reuniao|captacao), inicio, fim, local_ou_link, status (agendado|reagendado|cancelado|realizado|nao_compareceu), responsavel_id, evento_externo_id`

**Disponibilidade**
`id, agencia_id, usuario_id (opcional), tipo (reuniao|captacao), dia_semana, hora_inicio, hora_fim, duracao_minutos`

**Bloqueio** (feriados/folgas)
`id, agencia_id, data_inicio, data_fim, motivo`

**ConfigAgencia**
`agencia_id, prazo_producao_dias_uteis, antecedencia_minima_horas, intervalo_reuniao_captacao_dias_min, validade_link_dias, limite_reagendamentos, canal_notificacao_padrao, ...`

**TemplateMensagem**
`id, agencia_id, evento, canal (whatsapp|email), assunto, corpo (com variáveis), ativo`

**Notificacao** (log)
`id, onboarding_id, evento, canal, destinatario, enviado_em, status (enviado|falhou|entregue), erro`

**AuditoriaLog**
`id, agencia_id, usuario_id/ator, acao, entidade, entidade_id, em`

---

## 5. Fluxo ponta a ponta

```
[1] Agência cadastra cliente novo ──▶ [2] Sistema cria Onboarding + 4 etapas + link único
        │
        ▼
[3] Envio automático do convite (WhatsApp/e-mail) com o link
        │
        ▼
[4] Cliente abre o link (página única, sem login)
        ├─ Etapa A: Formulário de dados da empresa
        ├─ Etapa B: Acessos aos perfis
        ├─ Etapa C: Escolhe horário da 1ª reunião
        └─ Etapa D: Escolhe data da 1ª captação
        │
        ▼
[5] Sistema confirma: cria eventos na agenda, calcula prazo de liberação,
    envia resumo/confirmação ao cliente e notifica a agência
        │
        ▼
[6] Lembretes automáticos (pendências e compromissos)
        │
        ▼
[7] Reunião e captação realizadas ──▶ [8] Entrega dos primeiros conteúdos ──▶ Onboarding concluído
```

As etapas A–D são liberadas **em sequência** (RN-79): o cliente pode salvar e voltar em momentos diferentes, e pode abrir uma etapa ainda bloqueada para ver o que vem pela frente, mas só consegue agir nela depois de concluir as anteriores. _(Revisado em 2026-11-14 com o PO: substitui a ordem livre.)_

---

## 6. Regras de negócio

### 6.1 Cadastro e criação do onboarding

**RN-04** — Campos obrigatórios do cliente: nome da empresa, nome do contato, telefone WhatsApp **ou** e-mail (pelo menos um canal de contato válido).
**RN-05** — Telefone deve ser validado e normalizado (formato E.164, DDI 55 por padrão). E-mail deve ser validado.
**RN-06** — Ao criar um cliente, o sistema cria automaticamente **um** onboarding com as quatro etapas (formulário, acessos, reunião, captação), todas em status `pendente`.
**RN-07** — Um cliente só pode ter **um onboarding ativo** por vez. Cadastro duplicado (mesmo e-mail ou telefone na mesma agência) deve alertar o usuário antes de criar.
**RN-08** — O Admin pode atribuir um responsável ao onboarding; se não atribuir, o responsável padrão é o Admin.
**RN-09** — A criação do cliente dispara o envio do convite automaticamente, a menos que o usuário marque "enviar convite depois".

### 6.2 Link único

**RN-10** — Cada onboarding possui um token aleatório, não sequencial e não adivinhável (mínimo 128 bits de entropia), usado na URL do cliente.
**RN-11** — O link expira após `validade_link_dias` **[CONFIGURÁVEL, padrão sugerido: 14]**. Link expirado exibe mensagem amigável e botão para solicitar novo link à agência.
**RN-12** — O Admin/responsável pode **regenerar** o link; o token anterior é invalidado imediatamente.
**RN-13** — O link dá acesso **somente** ao onboarding daquele cliente. Nenhuma outra informação da agência ou de outros clientes pode ser exposta.
**RN-14** — Depois da conclusão do onboarding, o link passa a exibir apenas uma tela de resumo (somente leitura).

### 6.3 Etapa A — Formulário de dados da empresa

**RN-15** — A agência possui um **modelo de formulário padrão** editável. Alterações no modelo criam nova versão; respostas já enviadas permanecem vinculadas à versão com que foram respondidas. Ao cadastrar o cliente (ou depois, pelo detalhe do onboarding), a agência pode **personalizar as perguntas só para aquele cliente**: parte do modelo padrão vigente e adiciona, remove ou edita perguntas sem alterar o modelo padrão. Cada alteração da personalização gera uma nova versão própria daquele onboarding. A personalização **trava** quando o cliente começa a responder (primeiro rascunho salvo com alguma resposta; só abrir a página não conta). _(Revisado em 2026-11-14.)_
**RN-16** — Campos suportados: texto curto, texto longo, número, seleção única, múltipla escolha, data, URL. O cliente **não envia arquivos** pelo link (logo, manual de marca etc. ficam fora do onboarding). _(Revisado em 2026-11-14.)_
**RN-17** — Campos podem ser obrigatórios ou opcionais. A etapa só é considerada `concluida` quando todos os campos obrigatórios estiverem preenchidos e válidos.
**RN-18** — O formulário permite **salvar rascunho automaticamente**; o cliente pode sair e voltar pelo mesmo link sem perder o que preencheu.
**RN-19** — Conteúdo sugerido para o modelo padrão (editável): dados da empresa, segmento, público-alvo, concorrentes, tom de voz, redes sociais atuais, objetivos com o conteúdo, pontos proibidos/restrições, datas e produtos importantes, contato para aprovação de conteúdo.
**RN-20** — ~~Uploads: limite de tamanho e tipos permitidos~~ **Removida em 2026-11-14:** não há envio de arquivos no onboarding (ver RN-16).
**RN-21** — Após o envio final, o cliente pode editar as respostas até a agência marcar a etapa como "fechada" ou até a reunião ocorrer; toda edição gera registro de auditoria.

### 6.4 Etapa B — Acessos aos perfis

**RN-22** — O método **preferencial** de acesso é por **permissão/parceiro**, sem compartilhar senha (ex.: adicionar a agência como parceiro/administrador no Meta Business Manager). O sistema mostra instruções passo a passo e o identificador da agência a ser adicionado.

> **Login e senha ficam fora do sistema (decisão do PO, 2026-11-14).** O acesso é sempre por parceiro/permissão (RN-22). Se a agência precisar de uma senha, ela é combinada por fora, como hoje. RN-23 a RN-26 não serão implementadas no MVP e o campo `permitirCredenciais` permanece desligado.

**RN-23** — O método alternativo (credencial de acesso) só pode ser usado se o Admin habilitar essa opção na configuração. Se habilitado, o cliente deve ver aviso sobre os riscos e a alternativa recomendada.
**RN-24** — Senhas **nunca** são armazenadas em texto puro. Se o método credencial estiver habilitado, os dados devem ser cifrados em repouso (ex.: AES-256 com chave gerenciada fora do banco), exibidos mascarados e visíveis apenas ao responsável e ao Admin.
**RN-25** — Todo acesso de leitura a credencial gera registro em `AuditoriaLog`.
**RN-26** — Credenciais devem poder ser **apagadas** pela agência e pelo cliente (solicitação) a qualquer momento, e são removidas automaticamente em até `retencao_credencial_dias` após o encerramento do contrato **[CONFIGURÁVEL]**.
**RN-27** — A etapa tem status individual por plataforma (`pendente|concedido|invalido`). A agência **escolhe, por cliente, quais plataformas pedir** (no cadastro ou depois, pelo detalhe do onboarding). As plataformas vêm marcadas conforme a configuração da agência (`plataformasObrigatorias`), e qualquer uma pode ser desmarcada, inclusive Instagram e Facebook, mas é preciso escolher **pelo menos uma**. O cliente só vê as plataformas escolhidas. A etapa de acessos é `concluida` quando todas as plataformas escolhidas estiverem `concedido`. A escolha **trava** quando a etapa começa: o cliente clica "Já adicionei" em alguma plataforma, ou a agência marca alguma como concedida ou inválida. _(Revisado em 2026-11-14.)_
**RN-28** — A agência pode marcar manualmente um acesso como `concedido` (por exemplo, após confirmar o convite no Business Manager) ou `invalido`, com motivo; no caso de `invalido`, o cliente é notificado para corrigir.
**RN-29** — Nunca pedir ou aceitar credenciais por WhatsApp/e-mail nos templates de mensagem; o texto deve sempre direcionar ao link do sistema.

### 6.4.1 Ordem das etapas

**RN-79** — As etapas são liberadas em sequência: o **formulário enviado** libera Acessos; o cliente **ter avisado em todas as plataformas escolhidas** (ou a agência já ter marcado como concedidas) libera Reunião; a **reunião agendada** libera Captação (ver também RN-39). Uma etapa bloqueada pode ser aberta para ver as informações, mas mostra um alerta dizendo que as anteriores precisam ser concluídas, e o servidor recusa ações nela. Se algo anterior volta atrás (a agência reabre o formulário, ou marca um acesso como inválido), a etapa seguinte volta a travar **só se ainda não foi feita** (por exemplo, uma reunião já agendada continua valendo). Ao concluir uma etapa sem erro nem falta de informação, o cliente é levado automaticamente para a seguinte. _(Nova em 2026-11-14.)_

### 6.5 Etapa C — Primeira reunião

**RN-30** — O cliente escolhe um horário entre os **slots disponíveis**, gerados a partir de `Disponibilidade` (tipo `reuniao`), descontando `Bloqueio`, feriados e agendamentos existentes.
**RN-31** — Respeitar `antecedencia_minima_horas` **[CONFIGURÁVEL, padrão sugerido: 24h]**: não exibir slots mais próximos que isso.
**RN-32** — Horários exibidos no fuso do cliente (detectado pelo navegador, com opção de alterar); armazenados em UTC.
**RN-33** — Nenhum slot pode sofrer **overbooking**: a reserva deve ser atômica (concorrência tratada no banco).
**RN-34** — Ao confirmar, o sistema: cria o `Agendamento`, cria evento no calendário da agência (e convite ao cliente), gera link de videochamada se o formato for online **[CONFIGURÁVEL]** e envia confirmação.
**RN-35** — O cliente pode **reagendar** até `limite_reagendamentos` vezes **[CONFIGURÁVEL, padrão sugerido: 2]** e até X horas antes do horário **[CONFIGURÁVEL]**. Além disso, deve contatar a agência.
**RN-36** — Reagendar libera o slot antigo e atualiza o evento externo; cancelar apenas via agência após o limite.
**RN-37** — Se o cliente não comparecer, o responsável marca `nao_compareceu`; o sistema envia mensagem automática oferecendo reagendamento e alerta o responsável.

### 6.6 Etapa D — Primeira captação

**RN-38** — O cliente escolhe data e horário da captação entre os slots de `Disponibilidade` do tipo `captacao`, com duração definida em configuração **[CONFIGURÁVEL]**.
**RN-39** — A captação deve ser agendada **depois da primeira reunião**, com intervalo mínimo `intervalo_reuniao_captacao_dias_min` **[CONFIGURÁVEL, padrão sugerido: 1 dia]**. Se a reunião ainda não estiver agendada, a etapa D fica `bloqueada` com explicação clara ao cliente.
**RN-40** — Campos adicionais da captação: endereço/local, contato no local, observações (ex.: produtos a filmar, restrições). Local é obrigatório quando a captação for presencial.
**RN-41** — Regras de reserva, reagendamento, cancelamento e não comparecimento seguem RN-33 a RN-37, adaptadas à captação.
**RN-42** — Se o responsável pela captação for diferente do responsável pelo onboarding, a disponibilidade considerada é a do profissional de captação.

### 6.7 Prazo de liberação dos primeiros conteúdos

**RN-43** — O prazo é **calculado automaticamente** como:
`prazo_liberacao = data_captacao + prazo_producao_dias_uteis`
onde `prazo_producao_dias_uteis` é **[CONFIGURÁVEL por agência, padrão sugerido: 5]**.
**RN-44** — Dias úteis desconsideram sábados, domingos, feriados nacionais e os `Bloqueio` cadastrados.
**RN-45** — O prazo só é **confirmado e comunicado** ao cliente depois que a captação estiver agendada. Antes disso, a tela mostra "o prazo será definido após o agendamento da captação".
**RN-46** — Se a captação for reagendada, o prazo é **recalculado** e o cliente é notificado da nova data.
**RN-47** — O responsável pode ajustar manualmente o prazo, com justificativa obrigatória; o cliente é notificado e a alteração é auditada.
**RN-48** — A data de prazo aparece no painel da agência com indicadores: `no_prazo`, `atencao` (faltam ≤ 2 dias úteis) e `atrasado`.

### 6.8 Status e conclusão do onboarding

**RN-49** — Status geral do onboarding (derivado das etapas e eventos):
`criado → convite_enviado → em_andamento → aguardando_agendamentos → aguardando_reuniao/captacao → em_producao → primeiro_conteudo_entregue → concluido`; estados laterais: `pausado`, `cancelado`.
**RN-50** — O onboarding passa a `em_andamento` quando o cliente abre o link pela primeira vez (registrar data/hora).
**RN-51** — Passa a `em_producao` quando a captação é marcada como `realizada`.
**RN-52** — Passa a `primeiro_conteudo_entregue` quando o responsável registra a entrega dos primeiros conteúdos; passa a `concluido` quando o responsável confirma o encerramento (ou automaticamente N dias após a entrega **[CONFIGURÁVEL]**).
**RN-53** — O Admin pode `pausar` e `cancelar` onboardings, com motivo. Cancelar invalida o link, cancela agendamentos futuros e avisa o cliente (se houver template ativo). Lembretes cessam.
**RN-54** — Uma etapa `concluida` pode ser reaberta pela agência, com motivo.

### 6.9 Notificações e lembretes

**RN-55** — Eventos que disparam notificação (todos com template editável por agência, ver seção 8):

1. Convite inicial com link.
2. Confirmação de reunião agendada.
3. Confirmação de captação agendada + prazo de liberação.
4. Resumo final de onboarding completo.
5. Lembrete de pendência ao cliente.
6. Lembrete de compromisso (reunião e captação).
7. Reagendamento/cancelamento.
8. Acesso inválido (pedir correção).
9. Prazo recalculado/ajustado.
10. Alertas internos para a agência (ver RN-58).
    **RN-56** — **Lembretes de pendência** ao cliente: D+1, D+3 e D+5 após o convite, enquanto houver etapa pendente **[CONFIGURÁVEL]**. Cada lembrete lista objetivamente o que falta. Máximo de lembretes configurável; após o limite, apenas alerta interno.
    **RN-57** — **Lembretes de compromisso:** 24 horas e 2 horas antes de reunião e captação **[CONFIGURÁVEL]**.
    **RN-58** — **Alertas internos** ao responsável/Admin: cliente concluiu todas as etapas; link aberto e nenhuma ação em X dias; lembretes esgotados sem resposta; acesso marcado como inválido; não comparecimento; prazo em `atencao` ou `atrasado`.
    **RN-59** — Respeitar horário permitido para envio ao cliente (ex.: 08h–20h, sem domingos) **[CONFIGURÁVEL]**; mensagens fora da janela são enfileiradas.
    **RN-60** — Canal: usar o canal preferencial do cliente (WhatsApp ou e-mail). Se falhar o envio, tentar o canal alternativo (se houver contato) e registrar a falha.
    **RN-61** — Envio por WhatsApp deve usar a API oficial (ou provedor autorizado) e respeitar as regras de templates aprovados e opt-in. O cliente deve ter a opção de parar de receber lembretes (opt-out).
    **RN-62** — Toda notificação é registrada em `Notificacao` (status, canal, erro). Falhas são reenviadas com política de retentativa (ex.: 3 tentativas com backoff).

### 6.10 Painel da agência

**RN-63** — O painel lista todos os onboardings com: cliente, responsável, status geral, progresso (X de 4 etapas), próximos compromissos, prazo de liberação e indicadores de atenção.
**RN-64** — Filtros: status, responsável, etapa pendente, período, indicador de prazo.
**RN-65** — A tela de detalhe do onboarding mostra: linha do tempo de eventos, respostas do formulário, status de cada acesso, agendamentos, histórico de notificações e ações rápidas (reenviar convite, regenerar link, reenviar lembrete, ajustar prazo, pausar, cancelar, reabrir etapa).
**RN-66** — Ação rápida "reenviar lembrete" respeita um intervalo mínimo entre envios para evitar spam ao cliente **[CONFIGURÁVEL]**.

### 6.11 Integrações

**RN-67** — **Calendário:** integração com Google Calendar (mínimo no MVP) para criar/atualizar/cancelar eventos e verificar conflitos reais de agenda. A falha de integração não pode corromper o agendamento interno: marcar `evento_externo_id` como pendente e tentar novamente.
**RN-68** — **Mensageria:** WhatsApp (API oficial ou provedor) e e-mail transacional.
**RN-69** — **Armazenamento:** **removida em 2026-11-14.** O sistema não guarda arquivos do cliente (ver RN-16). A criação de pasta no Drive/Notion do cliente continua como ideia pós-MVP.
**RN-70** — **Gerenciador de tarefas (pós-MVP):** criar card/projeto do cliente (ClickUp, Trello, Notion etc.) com as tarefas iniciais.
**RN-71** — Integrações devem ser isoladas por interface/adaptador, para trocar de provedor sem alterar regras de negócio.

---

## 7. Máquina de estados (resumo)

**Etapa (`EtapaOnboarding.status`)**
`pendente → em_andamento → concluida`
`pendente|em_andamento → bloqueada` (ex.: captação sem reunião agendada) `→ pendente` (ao desbloquear)
`concluida → pendente` (reabertura, RN-54)

**Agendamento (`Agendamento.status`)**
`agendado → reagendado → agendado`
`agendado → realizado | nao_compareceu | cancelado`

**Onboarding (`status_geral`)** — ver RN-49. Transições inválidas devem ser rejeitadas pelo backend.

---

## 8. Templates de mensagem (padrões editáveis)

Variáveis disponíveis: `{{nome_contato}}`, `{{nome_empresa}}`, `{{nome_agencia}}`, `{{link_onboarding}}`, `{{data_reuniao}}`, `{{hora_reuniao}}`, `{{data_captacao}}`, `{{hora_captacao}}`, `{{local_captacao}}`, `{{prazo_liberacao}}`, `{{pendencias}}`, `{{responsavel}}`.

**Convite inicial**

> Olá, {{nome_contato}}! Seja bem-vindo(a) à {{nome_agencia}} 🎉
> Para começarmos a produzir o conteúdo da {{nome_empresa}} o quanto antes, preparamos um passo a passo rápido (leva poucos minutos): {{link_onboarding}}
> Lá você preenche os dados da empresa, libera os acessos e já escolhe os horários da nossa primeira reunião e da captação.

**Confirmação final com prazo**

> Tudo certo, {{nome_contato}}! ✅
> Reunião: {{data_reuniao}} às {{hora_reuniao}}.
> Captação: {{data_captacao}} às {{hora_captacao}} ({{local_captacao}}).
> Previsão de liberação dos primeiros conteúdos: **{{prazo_liberacao}}**.

**Lembrete de pendência**

> Oi, {{nome_contato}}! Faltam só alguns passos para começarmos: {{pendencias}}. Você conclui por aqui: {{link_onboarding}}

**Lembrete de compromisso**

> Lembrete: {{tipo}} da {{nome_empresa}} em {{data}} às {{hora}}. Precisa reagendar? {{link_onboarding}}

> Todos os templates: nunca pedir senha dentro da mensagem (RN-29).

---

## 9. Segurança, privacidade e conformidade (LGPD)

**RN-72** — Coletar **consentimento explícito** do cliente no primeiro acesso ao link (uso dos dados para prestação do serviço e contato). Registrar data, hora e versão do termo.
**RN-73** — Coletar apenas dados necessários (minimização). Permitir exportar e excluir os dados de um cliente a pedido.
**RN-74** — Toda comunicação por HTTPS. Dados sensíveis cifrados em repouso (ver RN-24).
**RN-75** — Isolamento entre agências (multi-tenant lógico): toda consulta filtra por `agencia_id`; testes automatizados devem garantir que uma agência nunca acessa dados de outra.
**RN-76** — Proteção contra abuso no link público: limite de requisições por IP/token, sem enumeração de tokens, cabeçalhos de segurança e proteção contra CSRF/XSS.
**RN-77** — Registrar em auditoria: criação/edição de cliente, mudanças de status, ajuste manual de prazo, leitura/exclusão de credenciais, regeneração de link.
**RN-78** — Backups periódicos e política de retenção definida **[CONFIGURÁVEL]**.

---

## 10. Requisitos não funcionais

- **Usabilidade:** a página do cliente deve ser **mobile-first**, simples, em uma única tela com etapas visíveis (barra de progresso), linguagem leve e sem jargão. Meta: concluir em até 10 minutos.
- **Desempenho:** páginas principais em menos de 2 s em 4G; geração de slots em menos de 1 s.
- **Disponibilidade:** tolerância a falha das integrações (fila + retentativa, RN-62 e RN-67).
- **Observabilidade:** logs estruturados, rastreio de erros e métricas de funil (abertura do link, conclusão por etapa, tempo até conclusão).
- **Acessibilidade:** contraste adequado e navegação por teclado nas telas do cliente.
- **Testes:** unitários para as regras (RN), integração para agendamento/concorrência e notificações, e ao menos um teste ponta a ponta do fluxo feliz.
- **Fuso horário:** armazenar em UTC; exibir no fuso do usuário; calcular dias úteis no fuso da agência.

---

## 11. Telas (visão de produto)

**Agência (login)**

1. Painel de onboardings (lista + filtros + indicadores; progresso com um ícone por etapa).
2. Novo cliente (cadastro rápido + personalizar perguntas e acessos daquele cliente + envio de convite).
3. Detalhe do onboarding (timeline, respostas, acessos, agenda, notificações, ações).
4. Configurações: dados da agência, prazos, disponibilidade e bloqueios, modelo de formulário, templates de mensagem, integrações, métodos de acesso permitidos.

**Cliente (link único, sem login)**

1. Boas-vindas + consentimento.
2. Página única com 4 etapas, barra de progresso e botões no topo para ir de uma etapa a outra sem rolar: dados da empresa → acessos → reunião → captação (liberação sequencial, RN-79).
3. Confirmação final com resumo (datas e prazo de liberação).
4. Tela de link expirado / onboarding concluído.

---

## 12. Critérios de aceite (principais cenários)

1. **Fluxo feliz:** dado um cliente cadastrado, quando o cliente abre o link e conclui as quatro etapas, então o onboarding fica com todas as etapas `concluida`, os eventos existem no calendário, o prazo de liberação é calculado conforme RN-43/44, o cliente recebe a confirmação e a agência recebe o alerta de conclusão.
2. **Rascunho:** dado um formulário parcialmente preenchido, quando o cliente fecha e reabre o link, então as respostas permanecem (RN-18).
3. **Dependência:** dado que a reunião não foi agendada, quando o cliente tenta agendar a captação, então a etapa D aparece bloqueada com explicação (RN-39).
4. **Overbooking:** dados dois clientes escolhendo o mesmo slot simultaneamente, então apenas um é confirmado e o outro recebe nova lista de horários (RN-33).
5. **Reagendamento:** ao reagendar a captação, o prazo de liberação é recalculado e o cliente é notificado (RN-46).
6. **Link expirado:** após `validade_link_dias`, o link exibe mensagem amigável e permite solicitar novo link (RN-11).
7. **Pendências:** sem ação do cliente, os lembretes saem em D+1, D+3 e D+5 e, esgotados, a agência é alertada (RN-56/58).
8. **Segurança:** uma agência não acessa dados de outra; senhas nunca aparecem em texto puro nos logs ou banco (RN-24/75).
9. **Cancelamento:** ao cancelar um onboarding, link invalidado, agendamentos futuros cancelados e lembretes interrompidos (RN-53).
10. **Fora da janela de envio:** mensagem gerada às 23h é enfileirada para o próximo horário permitido (RN-59).

---

## 13. Métricas de sucesso

- Tempo médio entre cadastro do cliente e conclusão das 4 etapas.
- % de clientes que concluem sem intervenção manual da agência.
- Número médio de mensagens manuais trocadas por onboarding (meta: reduzir drasticamente).
- Taxa de comparecimento a reunião e captação.
- Tempo entre captação e entrega dos primeiros conteúdos vs. prazo prometido.

---

## 14. Fases de entrega

### Fase 1 — MVP

- Cadastro de cliente + criação automática do onboarding (RN-04 a RN-09).
- Link único com expiração e regeneração (RN-10 a RN-14).
- Formulário configurável com rascunho (RN-15 a RN-21).
- Etapa de acessos por permissão/parceiro, com instruções e plataformas escolhidas por cliente (RN-22, 27 a 29). Login e senha ficam fora do sistema (RN-23 a 26 não entram).
- Agendamento de reunião e captação com disponibilidade, bloqueios, reagendamento e proteção contra overbooking (RN-30 a RN-42).
- Cálculo e comunicação do prazo de liberação (RN-43 a RN-48).
- Notificações por e-mail e WhatsApp, lembretes e alertas internos (RN-55 a RN-62).
- Integração com Google Calendar (RN-67).
- Painel básico e tela de detalhe (RN-63 a RN-66).
- Segurança e LGPD essenciais (RN-72 a RN-77).

### Fase 2

- Fluxo de aprovação de conteúdo e agendamento de posts (preferir integrar ferramenta existente).
- Integração com gerenciador de tarefas e criação de pastas (RN-69/70).
- Múltiplos modelos de formulário por tipo de serviço/segmento.
- Marca própria (white-label) da página do cliente.

### Fase 3

- Multi-agência com planos e cobrança (SaaS).
- Relatórios e métricas avançadas, NPS do onboarding.
- Assinatura de contrato integrada.

---

## 15. Premissas e perguntas em aberto

**Premissas adotadas (derivadas da conversa com a cliente):**

- O foco inicial é agência de social media/marketing, com um fluxo de entrada de cliente padronizado.
- O objetivo é concentrar formulário, acessos, agendamentos e prazo em um só lugar, de forma simples e automática.
- A cliente deseja que o cliente receba os prazos e datas automaticamente ao entrar.

**Perguntas a confirmar antes de implementar:**

1. Qual o prazo padrão entre captação e liberação dos primeiros conteúdos (padrão sugerido: 5 dias úteis)?
2. Quem faz a captação: a própria dona, um profissional da equipe ou terceiros? Há mais de um profissional com agenda própria?
3. As reuniões são online, presenciais ou ambos? Qual ferramenta de vídeo?
4. A agência aceita receber credenciais (login/senha) ou só acesso por Business Manager/parceiro? Quais plataformas são obrigatórias (Instagram, Facebook, TikTok, Google etc.)?
5. Qual provedor de WhatsApp será usado (API oficial direta ou provedor terceiro)? Já existe número comercial e templates aprovados?
6. Qual calendário é usado hoje (Google Calendar, Outlook, outro)?
7. Haverá mais de uma agência usando o sistema desde o início (multi-tenant) ou começa com uma só?
8. O sistema deve incluir já no MVP a aprovação/agendamento de conteúdo, ou só o onboarding?
9. Quais campos exatos o formulário da agência atual possui hoje (para importar como modelo padrão)?
10. Qual o horário de atendimento e a política de feriados a considerar no cálculo de dias úteis?

---

## 16. Sugestão de stack (opcional, ajustar à preferência)

- **Backend:** Node.js (TypeScript) com NestJS/Fastify, ou Python com FastAPI.
- **Banco:** PostgreSQL (transações e restrições para evitar overbooking).
- **Filas/Jobs:** BullMQ/Redis (ou equivalente) para lembretes, retentativas e cálculo agendado.
- **Frontend:** Next.js/React, mobile-first.
- **Integrações:** Google Calendar API, API oficial do WhatsApp (ou provedor), e-mail transacional (Resend, Postmark ou similar).
- **Alternativa de baixo código para validar rápido:** formulário (Tally/Typeform) + agenda (Cal.com) + automação (n8n/Make) + banco (Airtable/Notion), migrando para código quando o fluxo estiver provado.
