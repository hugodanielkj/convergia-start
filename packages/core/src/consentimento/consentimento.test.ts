import { describe, expect, it } from 'vitest';
import { STATUS_ONBOARDING } from '../onboarding/index.js';
import { TERMO_ATUAL, aceiteValido, statusAposPrimeiroAcesso } from './index.js';

describe('RN-50 primeiro acesso põe o onboarding em andamento', () => {
  it('criado e convite_enviado passam a em_andamento', () => {
    expect(statusAposPrimeiroAcesso('criado')).toBe('em_andamento');
    expect(statusAposPrimeiroAcesso('convite_enviado')).toBe('em_andamento');
  });

  it('qualquer outro status permanece como está', () => {
    for (const status of STATUS_ONBOARDING) {
      if (status === 'criado' || status === 'convite_enviado') continue;
      expect(statusAposPrimeiroAcesso(status)).toBe(status);
    }
  });
});

describe('RN-72 termo de consentimento versionado', () => {
  it('o termo atual tem versão e texto sobre uso dos dados e contato', () => {
    expect(TERMO_ATUAL.versao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TERMO_ATUAL.texto).toMatch(/dados/i);
    expect(TERMO_ATUAL.texto).toMatch(/contato/i);
  });

  it('só vale o aceite da versão vigente do termo', () => {
    expect(aceiteValido(TERMO_ATUAL.versao)).toBe(true);
    expect(aceiteValido('1999-01-01')).toBe(false);
    expect(aceiteValido('')).toBe(false);
  });
});
