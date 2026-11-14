# Acessos escolhidos por cliente (S6-3)

- **Data / trilha:** 2026-11-14 / A
- **Regras:** RN-27 (revisada), RN-22, RN-28.
- **Decisão:**
  - A agência escolhe quais plataformas pedir a cada cliente: na seção "Personalizar acessos" do cadastro ou em `/onboardings/[id]/personalizar`. As plataformas vêm marcadas conforme `plataformasObrigatorias` da config. Qualquer uma pode ser desmarcada, mas é preciso escolher **pelo menos uma** (PO, 2026-11-14).
  - A escolha fica na tabela `escolhas_acessos`, uma linha por onboarding. Onboardings sem escolha gravada usam `plataformasObrigatorias`.
  - O cliente só vê as plataformas escolhidas. A etapa conclui quando todas as escolhidas estão `concedido`.
  - **Trava:** a escolha trava quando a etapa começa, ou seja, quando o cliente clica "Já adicionei" em alguma plataforma ou a agência marca alguma como concedida ou inválida (PO, 2026-11-14). Depois disso, a API recusa a edição com 409.
  - Quem edita: o admin ou o responsável (RN-02). Toda mudança é auditada (RN-77).
- **Motivo:** cada cliente usa redes diferentes. Pedir uma plataforma que o cliente não tem travava o onboarding.
- **Substitui:** a regra "obrigatórias da config" de `2026-11-14-a-acessos-por-parceiro.md`.
