import { describe, expect, it } from 'vitest';
import { formatarDataHora, formatarTelefone, textoDoConvite, urlCompleta } from './formatar';
import {
  descreverMotivos,
  mensagemDeErroCampo,
  rotuloEtapa,
  rotuloStatusOnboarding,
} from './mensagens';

describe('telefone na tela', () => {
  it.each([
    ['+5531999998888', '(31) 99999-8888'],
    ['+553133334444', '(31) 3333-4444'],
    ['+351912345678', '+351912345678'],
  ])('mostra %s como %s', (entrada, esperado) => {
    expect(formatarTelefone(entrada)).toBe(esperado);
  });
});

describe('data na tela', () => {
  it('converte de UTC para o fuso da agência (D-14)', () => {
    expect(formatarDataHora('2026-11-16T15:30:00.000Z')).toMatch(/^16\/11\/2026,? 12:30$/);
  });
});

describe('endereço do link', () => {
  it('junta a origem e o caminho sem barra duplicada', () => {
    expect(urlCompleta('https://start.exemplo.com/', '/o/abc')).toBe(
      'https://start.exemplo.com/o/abc',
    );
    expect(urlCompleta('http://localhost:3000', '/o/abc')).toBe('http://localhost:3000/o/abc');
  });
});

describe('textos de erro (RN-04, RN-05)', () => {
  it.each([
    ['obrigatorio', /Preencha/],
    ['contato_obrigatorio', /WhatsApp ou um e-mail/],
    ['telefone_invalido', /Telefone inválido/],
    ['ddd_invalido', /DDD/],
    ['email_invalido', /E-mail inválido/],
    ['codigo_novo_da_api', /Valor inválido/],
  ])('traduz %s', (codigo, esperado) => {
    expect(mensagemDeErroCampo(codigo)).toMatch(esperado);
  });
});

describe('alerta de duplicidade (RN-07)', () => {
  it.each([
    [['email'], 'o mesmo e-mail'],
    [['whatsapp'], 'o mesmo WhatsApp'],
    [['whatsapp', 'email'], 'o mesmo e-mail e WhatsApp'],
  ] as const)('descreve %j', (motivos, esperado) => {
    expect(descreverMotivos(motivos)).toBe(esperado);
  });
});

describe('rótulos', () => {
  it('traduz o conhecido e mostra o desconhecido como veio', () => {
    expect(rotuloEtapa('captacao')).toBe('Captação');
    expect(rotuloStatusOnboarding('em_producao')).toBe('Em produção');
    expect(rotuloStatusOnboarding('status_futuro')).toBe('status_futuro');
  });
});

describe('RN-09 e RN-59 texto do convite no cadastro', () => {
  const agora = new Date('2026-11-16T12:00:00.000Z');
  it('sem convite, pede para enviar o link', () => {
    expect(textoDoConvite(null, agora)).toBe(
      'O convite não foi enviado. Envie este link ao cliente:',
    );
  });
  it('saindo agora', () => {
    expect(textoDoConvite({ enviaEm: agora.toISOString() }, agora)).toBe(
      'O convite com este link está sendo enviado ao cliente.',
    );
  });
  it('fora do horário, diz quando sai', () => {
    expect(textoDoConvite({ enviaEm: '2026-11-17T11:00:00.000Z' }, agora)).toBe(
      'O convite com este link sai em 17/11/2026, 08:00, no horário permitido de envio.',
    );
  });
});
