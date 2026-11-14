# Feriados nacionais no código, bloqueios para o resto

- **Data / trilha:** 2026-11-14 / B
- **Decisão:** os feriados nacionais (1º de janeiro, Sexta-feira Santa, 21 de abril, 1º de maio, 7 de setembro, 12 de outubro, 2 e 15 de novembro, 20 de novembro e 25 de dezembro) são calculados por uma função pura em `core/agenda`, sem tabela. Feriado estadual, municipal, recesso e folga entram como **bloqueio** cadastrado pela agência (RN-44), por período e com motivo. Carnaval e Corpus Christi são ponto facultativo e não entram sozinhos: a agência bloqueia se parar nesses dias. Janela de atendimento: dias da semana e horários por profissional e tipo (reunião ou captação), em `Disponibilidade`.
- **Motivo:** feriado nacional é lei e muda pouco; tabela editável cria manutenção sem ganho. Tudo que varia por cidade ou por agência já cabe no bloqueio, que a spec já prevê. Responde a pergunta 10 da spec ("horário de atendimento e política de feriados") com os padrões acima, que a agência ajusta nas configurações.
- **Substitui:** —
