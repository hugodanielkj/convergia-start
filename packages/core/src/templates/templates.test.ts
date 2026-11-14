import { describe, expect, it } from 'vitest';
import {
  TEMPLATES_PADRAO,
  TIPOS_TEMPLATE,
  VARIAVEIS_TEMPLATE,
  preencherTemplate,
  validarTemplate,
  variaveisUsadas,
} from './index.js';

describe('RN-55 templates padrão da seção 8', () => {
  it('há um texto padrão para cada um dos 4 tipos', () => {
    expect(TIPOS_TEMPLATE).toEqual([
      'convite',
      'confirmacao_prazo',
      'lembrete_pendencia',
      'lembrete_compromisso',
    ]);
    for (const tipo of TIPOS_TEMPLATE) expect(TEMPLATES_PADRAO[tipo].length).toBeGreaterThan(20);
  });

  it('os textos padrão são válidos', () => {
    for (const tipo of TIPOS_TEMPLATE) {
      expect(validarTemplate(tipo, TEMPLATES_PADRAO[tipo])).toEqual([]);
    }
  });

  it('o convite leva o link e a confirmação leva o prazo', () => {
    expect(variaveisUsadas(TEMPLATES_PADRAO.convite)).toContain('link_onboarding');
    expect(variaveisUsadas(TEMPLATES_PADRAO.confirmacao_prazo)).toContain('prazo_liberacao');
  });
});

describe('RN-55 preencher variáveis', () => {
  it('troca cada variável pelo valor, inclusive repetidas', () => {
    expect(
      preencherTemplate('Oi {{nome_contato}}, {{nome_contato}}! {{link_onboarding}}', {
        nome_contato: 'Bia',
        link_onboarding: 'https://x/o/1',
      }),
    ).toBe('Oi Bia, Bia! https://x/o/1');
  });

  it('variável sem valor vira vazio, sem deixar as chaves no texto', () => {
    expect(preencherTemplate('Local: {{local_captacao}}.', {})).toBe('Local: .');
  });

  it('aceita espaços dentro das chaves', () => {
    expect(preencherTemplate('{{ nome_contato }}', { nome_contato: 'Bia' })).toBe('Bia');
  });
});

describe('RN-55 e RN-29 validação ao salvar', () => {
  it('recusa variável que não existe', () => {
    expect(validarTemplate('convite', 'Oi {{nome}} {{link_onboarding}}')).toEqual([
      { codigo: 'variavel_desconhecida', detalhe: 'nome' },
    ]);
  });

  it('recusa texto vazio ou longo demais', () => {
    expect(validarTemplate('convite', '   ')).toEqual([{ codigo: 'vazio' }]);
    expect(validarTemplate('convite', 'a'.repeat(1601))).toContainEqual({ codigo: 'muito_longo' });
  });

  it('o convite e o lembrete de pendência precisam do link do sistema (RN-29)', () => {
    expect(validarTemplate('convite', 'Oi {{nome_contato}}')).toEqual([{ codigo: 'sem_link' }]);
    expect(validarTemplate('lembrete_pendencia', 'Faltam passos: {{pendencias}}')).toEqual([
      { codigo: 'sem_link' },
    ]);
  });

  it('RN-29 recusa pedir senha ou credencial no texto', () => {
    for (const texto of [
      'Mande sua senha: {{link_onboarding}}',
      'Envie o PASSWORD do Instagram {{link_onboarding}}',
      'Passe o login e a senha {{link_onboarding}}',
    ]) {
      expect(validarTemplate('convite', texto)).toContainEqual({ codigo: 'pede_senha' });
    }
  });

  it('a palavra "senha" em outro sentido não é confundida (ex.: assinatura)', () => {
    expect(validarTemplate('convite', 'Oi {{nome_contato}} {{link_onboarding}} Obrigado')).toEqual(
      [],
    );
  });

  it('as 12 variáveis da spec existem, mais tipo, data e hora do compromisso', () => {
    expect(VARIAVEIS_TEMPLATE).toEqual(
      expect.arrayContaining([
        'nome_contato',
        'nome_empresa',
        'nome_agencia',
        'link_onboarding',
        'data_reuniao',
        'hora_reuniao',
        'data_captacao',
        'hora_captacao',
        'local_captacao',
        'prazo_liberacao',
        'pendencias',
        'responsavel',
        'tipo',
        'data',
        'hora',
      ]),
    );
  });
});
