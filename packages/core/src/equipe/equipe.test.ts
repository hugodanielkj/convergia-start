import { describe, expect, it } from 'vitest';
import { STATUS_ONBOARDING } from '../onboarding/index.js';
import { LIMITES_PESSOA, emAndamento, validarAlteracaoPropria, validarPessoa } from './index.js';

describe('RN-03 cadastro de pessoa da equipe', () => {
  it('normaliza o e-mail e tira espaços do nome', () => {
    expect(validarPessoa({ nome: '  Ana Souza ', email: ' Ana@Agencia.COM ' })).toEqual({
      ok: true,
      nome: 'Ana Souza',
      email: 'ana@agencia.com',
    });
  });

  it('recusa nome vazio ou longo demais', () => {
    expect(validarPessoa({ nome: '   ', email: 'a@b.com' })).toEqual({
      ok: false,
      erro: 'nome_invalido',
    });
    const longo = 'a'.repeat(LIMITES_PESSOA.nomeMax + 1);
    expect(validarPessoa({ nome: longo, email: 'a@b.com' })).toEqual({
      ok: false,
      erro: 'nome_invalido',
    });
  });

  it('recusa e-mail inválido', () => {
    expect(validarPessoa({ nome: 'Ana', email: 'ana@' })).toEqual({
      ok: false,
      erro: 'email_invalido',
    });
  });
});

describe('RN-03 o Admin não mexe na própria conta', () => {
  const ator = 'u1';

  it('não desativa nem muda o próprio papel', () => {
    expect(validarAlteracaoPropria(ator, 'u1')).toBe('propria_conta');
  });

  it('pode alterar outra pessoa', () => {
    expect(validarAlteracaoPropria(ator, 'u2')).toBeNull();
  });
});

describe('onboardings em andamento passam para quem assume', () => {
  it('só concluído e cancelado ficam com quem saiu', () => {
    const encerrados = STATUS_ONBOARDING.filter((s) => !emAndamento(s));
    expect(encerrados).toEqual(['concluido', 'cancelado']);
  });
});
