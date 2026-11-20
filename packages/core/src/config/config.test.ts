import { describe, expect, it } from 'vitest';
import { CONFIG_PADRAO } from '../base/config.js';
import {
  CAMPOS_NUMERICOS,
  LIMITES_CONFIG_GERAL,
  diferencas,
  extrairConfigGeral,
  validarConfigGeral,
  type ConfigGeral,
} from './index.js';

const valida: ConfigGeral = extrairConfigGeral('Convergia', CONFIG_PADRAO);

describe('RN-03 configurações gerais com limites', () => {
  it('os padrões do seed (D-09) estão dentro dos limites', () => {
    expect(validarConfigGeral(valida)).toEqual([]);
  });

  it('aceita os extremos de cada limite', () => {
    for (const campo of CAMPOS_NUMERICOS) {
      const { min, max } = LIMITES_CONFIG_GERAL[campo];
      expect(validarConfigGeral({ ...valida, [campo]: min })).toEqual([]);
      expect(validarConfigGeral({ ...valida, [campo]: max })).toEqual([]);
    }
  });

  it('recusa um a menos do mínimo e um a mais do máximo', () => {
    for (const campo of CAMPOS_NUMERICOS) {
      const { min, max } = LIMITES_CONFIG_GERAL[campo];
      const esperado = [{ campo, motivo: 'fora_do_limite' }];
      expect(validarConfigGeral({ ...valida, [campo]: min - 1 })).toEqual(esperado);
      expect(validarConfigGeral({ ...valida, [campo]: max + 1 })).toEqual(esperado);
    }
  });

  it('RN-43 prazo de produção entre 1 e 30 dias úteis', () => {
    expect(LIMITES_CONFIG_GERAL.prazoProducaoDiasUteis).toEqual({ min: 1, max: 30 });
  });

  it('recusa número quebrado e nome vazio ou longo', () => {
    expect(validarConfigGeral({ ...valida, validadeLinkDias: 2.5 })).toEqual([
      { campo: 'validadeLinkDias', motivo: 'invalido' },
    ]);
    expect(validarConfigGeral({ ...valida, nomeAgencia: '  ' })).toEqual([
      { campo: 'nomeAgencia', motivo: 'invalido' },
    ]);
    expect(validarConfigGeral({ ...valida, nomeAgencia: 'x'.repeat(81) })).toHaveLength(1);
  });
});

describe('RN-77 auditoria com antes e depois', () => {
  it('lista só o que mudou', () => {
    const depois = {
      ...valida,
      prazoProducaoDiasUteis: 7,
      canalNotificacaoPadrao: 'email' as const,
    };
    expect(diferencas(valida, depois)).toEqual({
      prazoProducaoDiasUteis: '5 → 7',
      canalNotificacaoPadrao: 'whatsapp → email',
    });
    expect(diferencas(valida, valida)).toEqual({});
  });
});
