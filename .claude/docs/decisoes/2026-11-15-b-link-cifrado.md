# Link do cliente guardado cifrado, além do hash

- **Data / trilha:** 2026-11-15 / B
- **Decisão (PO):** o token do link passa a ser guardado também **cifrado**, com uma chave que fica fora do banco. Assim os lembretes (dias depois do convite) levam sempre o mesmo link, e o detalhe do onboarding volta a ter "Copiar link". Opções descartadas: gerar um link novo a cada envio (a mensagem antiga deixaria de funcionar) e lembrete sem link (o cliente teria de achar o convite).
- **Decisão (técnica):**
  - A busca do link continua pelo hash SHA-256 (D-13), comparado em tempo constante. O cifrado só serve para montar o link de novo: AES-256-GCM, com IV aleatório por token, na coluna `tokenCifrado` de `links_onboarding`.
  - Chave em `LINK_CHAVE_CIFRA` (32 bytes em base64), nunca no banco nem em log. Um vazamento só do banco não revela os links; vazar banco **e** chave revela.
  - Em produção a chave é obrigatória (a API não sobe sem ela). Em desenvolvimento, sem a chave, o sistema funciona como antes: o link só aparece na criação e na regeneração, e mensagens que precisam do link (lembrete de pendência, de compromisso e reenvio de convite) não são enviadas. Links criados antes desta mudança não têm o cifrado: a agência usa "Regenerar link" (não há clientes reais ainda, D-23).
  - "Copiar link" no detalhe aparece para quem pode regenerar (Admin e responsável) e só em onboarding ativo; sem link recuperável, a tela orienta a usar "Regenerar link".
  - Regenerar troca hash e cifrado juntos, então o link antigo para de funcionar na hora (RN-12).
- **Motivo:** escolha do PO no planejamento da Sprint 5 (trilha B).
- **Substitui:** em parte `2026-11-13-b-link-so-aparece-na-criacao.md` (o link volta a poder ser copiado depois da criação).
