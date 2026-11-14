# Perguntas personalizadas por cliente (S6-2)

- **Data / trilha:** 2026-11-14 / A
- **Regras:** RN-15 (revisada), RN-17, RN-18.
- **Decisão:**
  - A agência pode personalizar as perguntas de um cliente, sem mudar o modelo padrão. Faz isso na seção "Personalizar dados da empresa" do cadastro ou, depois, em `/onboardings/[id]/personalizar`. O cartão do cliente em `/clientes` tem um atalho para essa tela.
  - A personalização parte da versão vigente do modelo padrão e permite adicionar, remover e editar perguntas. Se a agência não mexer em nada, nada é gravado e o cliente usa o modelo padrão, como hoje.
  - Cada vez que a agência salva a personalização, o sistema cria uma nova **versão do cliente**, imutável, na tabela `versoes_formulario_cliente`. Ela guarda o número, os campos, a versão padrão de origem e quem salvou. A resposta (`respostas_formulario.versaoClienteId`) fica presa à versão do cliente vigente quando ele começa a responder (RN-15). Sem personalização, continua presa à versão padrão.
  - **Trava:** a personalização trava quando o cliente começa a responder, ou seja, no primeiro rascunho salvo com alguma resposta. Só abrir a página não conta. Depois disso, a API recusa a edição com 409 e a tela mostra o motivo.
  - A personalização é uma foto da versão padrão do momento: se a agência publicar outra versão padrão depois, o cliente personalizado não muda.
  - Quem edita: o admin ou o responsável pelo onboarding (RN-02). Cada versão salva é auditada (RN-77).
- **Motivo:** o primeiro cliente pediu perguntas diferentes por cliente. Versões próprias mantêm o histórico sem bagunçar a numeração do modelo padrão.
- **Substitui:** complementa `2026-11-15-a-formulario-versionado.md`.
