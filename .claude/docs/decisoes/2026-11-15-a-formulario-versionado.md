# Modelo de formulário versionado (S2-2)

- **Data / trilha:** 2026-11-15 / A
- **Decisão:**
  - Cada agência tem uma tabela de **versões imutáveis** (`versoes_formulario`) e um **rascunho** (`modelos_formulario`). Salvar grava só o rascunho; **Publicar** cria a próxima versão (RN-15).
  - Campos têm `chave` estável gerada do rótulo; respostas (S2-3) guardarão a chave e a versão. Campo publicado **não é apagado** (só arquivado) e **não troca de tipo**.
  - O modelo padrão (RN-19) é criado sozinho no primeiro acesso, como versão 1. Obrigatórios: empresa, segmento e contato para aprovação. Logo e manual de marca são uploads opcionais.
  - Só admin lê e edita (RN-03). Publicação auditada (RN-77).
  - Rotas: `GET /formulario/modelo`, `PUT /formulario/modelo/rascunho`, `POST /formulario/modelo/publicar`. Tela: `/config/formulario`.
- **Contrato para a S2-3/S2-1:** `VersaoFormulario` (id, numero, campos) e tipos em `@convergia/core/formulario`.
- **Motivo:** preservar respostas já enviadas quando a agência muda as perguntas.
