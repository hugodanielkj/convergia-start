import { describe, expect, it } from 'vitest';
import {
  ESPERAS_ENTRE_TENTATIVAS_MIN,
  MAX_TENTATIVAS,
  decidirDepoisDeFalha,
  FalhaCalendarioError,
} from './index.js';

const AGORA = new Date('2026-11-16T12:00:00.000Z');
const MIN = 60 * 1000;

describe('RN-67 retentativa com espera crescente', () => {
  it('a primeira falha agenda nova tentativa em 1 minuto e as seguintes esperam cada vez mais', () => {
    expect(ESPERAS_ENTRE_TENTATIVAS_MIN).toEqual([1, 5, 15, 60, 360]);
    const proximas = ESPERAS_ENTRE_TENTATIVAS_MIN.map((_, i) => {
      const decisao = decidirDepoisDeFalha({
        tentativasFeitas: i,
        transitoria: true,
        agora: AGORA,
      });
      return decisao.tipo === 'tentar_de_novo'
        ? (decisao.em.getTime() - AGORA.getTime()) / MIN
        : null;
    });
    expect(proximas).toEqual([1, 5, 15, 60, 360]);
  });

  it('depois de esgotar as tentativas desiste e pede atenção da agência', () => {
    expect(MAX_TENTATIVAS).toBe(ESPERAS_ENTRE_TENTATIVAS_MIN.length);
    expect(
      decidirDepoisDeFalha({ tentativasFeitas: MAX_TENTATIVAS, transitoria: true, agora: AGORA }),
    ).toEqual({ tipo: 'desistir' });
    expect(
      decidirDepoisDeFalha({
        tentativasFeitas: MAX_TENTATIVAS + 3,
        transitoria: true,
        agora: AGORA,
      }),
    ).toEqual({ tipo: 'desistir' });
  });

  it('erro definitivo (credencial inválida, evento inexistente) não adianta repetir', () => {
    expect(decidirDepoisDeFalha({ tentativasFeitas: 0, transitoria: false, agora: AGORA })).toEqual(
      { tipo: 'desistir' },
    );
  });

  it('a falha do calendário carrega se vale tentar de novo', () => {
    expect(new FalhaCalendarioError('timeout', true).transitoria).toBe(true);
    expect(new FalhaCalendarioError('401', false).transitoria).toBe(false);
    expect(new FalhaCalendarioError('x', true)).toBeInstanceOf(Error);
  });
});
