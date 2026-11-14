# Link do cliente: o token só aparece ao criar ou regenerar

- **Data / trilha:** 2026-11-13 / B
- **Decisão:** como o banco guarda só o hash do token (D-13), a API mostra o link completo apenas na resposta que cria o cliente, cria um novo onboarding ou regenera o link. Depois disso não há como recuperar o mesmo link: para entregar de novo ao cliente, a agência usa "Gerar novo link" (RN-12), que invalida o anterior. A consulta pública (`GET /publico/onboardings/:token`) devolve 404 para token errado ou onboarding cancelado (iguais, para não revelar se o link existe) e 410 para link expirado, que a tela do cliente transforma na mensagem amigável da RN-11. Os logs trocam o token da URL por `:token`. Só o Admin e o responsável regeneram (RN-02, RN-12); onboarding concluído ou cancelado não gera link novo.
- **Motivo:** guardar o token para exibi-lo de novo enfraquece a proteção que a D-13 quer (um vazamento do banco daria todos os links válidos). A D-23 prevê o botão "Copiar link", que funciona na tela logo após o cadastro; para clientes antigos, o botão passa a ser "Gerar novo link". **Precisa do OK do PO**, porque muda o que a agência vê.
- **Substitui:** —
