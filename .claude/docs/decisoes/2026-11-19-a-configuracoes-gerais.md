# Configurações gerais da agência

- **Data / trilha:** 2026-11-19 / A
- **Decisão (PO):**
  - Tela Configurações › Geral, só para o Admin (RN-03), com o nome da agência, prazos, regras de agenda, avisos e canal padrão. Limites mínimo e máximo de cada campo na tabela da `sprints/sprint-08.md`.
  - A mudança vale daqui para frente: prazos já calculados e links já emitidos não mudam.
  - As plataformas marcadas por padrão para cada cliente novo ficam em Configurações › Acessos (pelo menos 1, RN-27).
  - Ficam de fora: fuso (segue São Paulo), logo e cor, login e senha (`permitirCredenciais` desligado).
- **Decisão (técnica):**
  - Os limites ficam numa constante do `core`, usada pela API (validação) e pela tela (campos `min`/`max`).
  - A auditoria guarda o valor antes e depois só dos campos que mudaram (RN-77).
- **Motivo:** D-09 deixou os valores no seed; a agência precisa ajustá-los sem desenvolvedor.
