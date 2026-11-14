import { describe, expect, it } from 'vitest';
import { estadoDaEtapa } from './estado-etapa';

describe('ícone de progresso por etapa (S6-5, RN-79)', () => {
  it('bloqueada mostra cadeado, mesmo que o status diga outra coisa', () => {
    expect(estadoDaEtapa({ status: 'pendente', liberada: false })).toBe('bloqueada');
  });

  it('concluída, em andamento e pendente seguem o status da etapa', () => {
    expect(estadoDaEtapa({ status: 'concluida', liberada: true })).toBe('concluida');
    expect(estadoDaEtapa({ status: 'em_andamento', liberada: true })).toBe('em_andamento');
    expect(estadoDaEtapa({ status: 'pendente', liberada: true })).toBe('pendente');
  });

  it('acessos avisados esperando a agência contam como em andamento', () => {
    expect(estadoDaEtapa({ status: 'pendente', liberada: true, feita: true })).toBe('em_andamento');
  });
});
