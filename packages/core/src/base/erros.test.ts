import { describe, expect, it } from 'vitest';
import {
  NaoAutenticadoError,
  NaoEncontradoError,
  ProibidoError,
  RegraVioladaError,
} from './erros.js';

describe('erros de domínio', () => {
  it('RegraVioladaError carrega o código da regra', () => {
    const erro = new RegraVioladaError('RN-07', 'Cliente já tem onboarding ativo');
    expect(erro).toMatchObject({ name: 'RegraVioladaError', codigo: 'RN-07' });
    expect(erro.message).toBe('Cliente já tem onboarding ativo');
  });

  it('NaoEncontradoError descreve o recurso', () => {
    expect(new NaoEncontradoError('Cliente').message).toBe('Cliente não encontrado');
  });

  it('ProibidoError e NaoAutenticadoError têm mensagens genéricas', () => {
    expect(new ProibidoError('RN-03').codigo).toBe('RN-03');
    expect(new NaoAutenticadoError().name).toBe('NaoAutenticadoError');
  });
});
