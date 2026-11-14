# Sprint 2 — Formulário do cliente · Disponibilidade e slots

**Status:** trilha A aprovada pelo PO em 2026-11-13.

**Objetivo:** a agência monta o modelo do formulário de onboarding e o cliente consegue preenchê-lo (trilha A); a agência define sua disponibilidade e o sistema gera slots sem overbooking (trilha B).

## Ordem (trilha A)

1. S2-2 primeiro (não depende da trilha B). 2. S2-4. 3. S2-1 e S2-3 quando a trilha B entregar a S1-5 (link único).

## Trilha A — PO

| ID   | História                               | Critérios de aceite                                                                                                                                            | Modelo / esforço |
| ---- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S2-2 | Modelo de formulário versionado        | Modelo padrão com os campos da RN-19 criado sozinho; agência (admin) edita campos e **publica** nova versão (RN-15); tipos da RN-16; versões antigas intactas. | Sonnet / médio   |
| S2-4 | Upload com validação no servidor       | Tipo e tamanho conferidos no servidor (RN-20); storage atrás de interface: pasta local em dev, S3 compatível em produção.                                      | Sonnet / médio   |
| S2-1 | Página do cliente                      | Boas-vindas, consentimento LGPD e progresso (RN-50, RN-72). Depende da S1-5.                                                                                   | Sonnet / médio   |
| S2-3 | Preenchimento com rascunho e conclusão | Rascunho automático, obrigatórios, edição após envio com auditoria (RN-17, RN-18, RN-21). Depende da S2-1 e S2-2.                                              | Sonnet / médio   |

## Trilha B — colaborador

| ID   | História                              | Critérios de aceite                                                                                                                                                                                                                                                                 | Modelo / esforço |
| ---- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| S2-5 | Disponibilidade, bloqueios e feriados | Admin cadastra janelas semanais de reunião e captação por profissional (RN-30, RN-42), e bloqueios por período com motivo; feriados nacionais calculados no `core` e somados aos bloqueios nos dias úteis (RN-44); tela em Configurações > Agenda; tudo restrito à agência (RN-75). | Sonnet / médio   |
| S2-6 | Geração de slots                      | Função pura que gera os slots livres a partir de disponibilidade, bloqueios, feriados e agendamentos, respeitando a antecedência mínima da configuração e devolvendo instantes em UTC com a conversão para o fuso do cliente (RN-30 a RN-32).                                       | Sonnet / médio   |
| S2-7 | Reserva atômica sem overbooking       | Tabela de agendamentos com restrição de exclusão por intervalo (`tstzrange`, D-11); reservar o mesmo slot ao mesmo tempo confirma só um e o outro recebe a lista atualizada (RN-33). Teste com reservas simultâneas no banco real.                                                  | Opus / alto      |

**Ordem:** S2-5, S2-6 e S2-7 (as três mexem em `modulos/agenda`, então vão em sequência). A S2-7 é a mais delicada; se possível rodar em sessão própria com Opus.

## Decisões (trilha B)

- Feriados nacionais são calculados em código (datas fixas, mais Sexta-feira Santa a partir da Páscoa): são lei, não configuração. Feriado estadual ou municipal entra como bloqueio cadastrado pela agência. Detalhes em `decisoes/2026-11-14-b-feriados-e-bloqueios.md`.

## Decisões (trilha A)

- Publicar cria a versão; salvar só grava rascunho. Campo removido fica **arquivado** (respostas antigas preservadas). Tipo de campo publicado não muda. Só admin edita (RN-03). Detalhes em `decisoes/2026-11-15-a-formulario-versionado.md`.
- Storage: interface com pasta local em dev e S3 compatível em produção (provedor escolhido no go-live).

## Entregue

### Trilha A

### Trilha B

## Retro

### Trilha A

### Trilha B
