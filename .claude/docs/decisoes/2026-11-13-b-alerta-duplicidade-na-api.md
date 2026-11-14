# Alerta de duplicidade na API de clientes

- **Data / trilha:** 2026-11-13 / B
- **Decisão:** `POST /clientes` não grava quando já existe cliente da agência com o mesmo e-mail ou WhatsApp (já normalizados): responde 409 com `erro: "RN-07"` e a lista de clientes coincidentes (id, nome da empresa e motivo). A tela mostra o alerta e, se o usuário confirmar, reenvia o mesmo cadastro com `confirmarDuplicidade: true`, que então grava. A confirmação fica registrada na auditoria (`duplicidadeConfirmada`). Não há índice único no banco para e-mail ou WhatsApp, porque a RN-07 permite cadastrar depois do alerta. A auditoria de criação não guarda dados de contato (LGPD).
- **Motivo:** a spec pede "alertar o usuário antes de criar", não bloquear. O alerta na própria rota evita uma segunda chamada só para consultar duplicidade e mantém a regra no servidor.
- **Substitui:** —
