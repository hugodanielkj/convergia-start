# Validação de telefone e e-mail do cliente sem biblioteca externa

- **Data / trilha:** 2026-11-13 / B
- **Decisão:** as regras de RN-04 e RN-05 ficam em `packages/core/src/clientes`, sem dependência nova. Telefone sem `+`/`00` é tratado como brasileiro: DDD conferido na lista da Anatel, celular com 9 dígitos começando por 9 e fixo com 8 dígitos começando por 2–5 (fixo aceito por causa do WhatsApp Business). Celular no formato antigo, sem o 9, é recusado. Número estrangeiro (com `+` ou `00`) recebe só a checagem estrutural do E.164 (8 a 15 dígitos). E-mail é validado por um subconjunto prático da RFC 5322 (sem acentos nem aspas) e guardado em minúsculas, para o alerta de duplicidade (RN-07) comparar valores iguais. A validação devolve todos os erros de uma vez, como códigos (`campo`, `codigo`, `regra`); o texto mostrado fica na tela.
- **Motivo:** quase todos os clientes da agência são brasileiros, e regras próprias bastam para eles sem mexer em `package.json`/lockfile, que são compartilhados. Se aparecerem muitos clientes estrangeiros, trocar por `libphonenumber-js` só muda `telefone.ts`.
- **Substitui:** —
