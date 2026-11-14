# Painel de onboardings (S3-3)

- **Regras:** RN-63, RN-64, RN-02, RN-75.
- **Colunas sem dados ainda:** "Próximo compromisso" (agenda, S3-4/S2-7) e "Prazo de liberação" (S4-5) existem no contrato da API (`null`) e aparecem como "—". Quando a trilha B entregar, só preencher a API.
- **Filtro "indicador de prazo" (RN-64):** como ainda não há prazo, o filtro vale para os indicadores de atenção que existem hoje: acesso inválido, link expirado e sem movimento (≥ `diasSemAcaoParaAlerta` dias, RN-58). O filtro de prazo propriamente dito entra com a S4-5.
- **Atenção:** encerrados (concluído/cancelado) e pausados não geram alerta. Regra pura em `core/painel`.
- **Filtros por URL** (`/onboardings?status=…`): a tela é um formulário comum, sem JavaScript; dá para guardar ou compartilhar o link filtrado.
- **Limite:** 200 mais recentes por consulta, com aviso na tela; paginação fica para quando houver volume.
- **Permissão:** membro só vê os seus, mesmo forçando `responsavelId` na URL (RN-02).
