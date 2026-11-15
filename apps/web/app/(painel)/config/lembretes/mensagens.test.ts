import { describe, expect, it } from 'vitest';
import { escreverLista, lerLista, mensagemDoMotivo } from './mensagens';

describe('RN-56 e RN-57 listas da tela de lembretes', () => {
  it('lê números separados por vírgula, ponto e vírgula ou espaço', () => {
    expect(lerLista('1, 3, 5')).toEqual([1, 3, 5]);
    expect(lerLista('24;2')).toEqual([24, 2]);
    expect(lerLista(' 2  24 ')).toEqual([2, 24]);
    expect(lerLista('')).toEqual([]);
  });

  it('recusa zero, negativo, decimal e texto', () => {
    expect(lerLista('0')).toBeNull();
    expect(lerLista('-1')).toBeNull();
    expect(lerLista('1.5')).toBeNull();
    expect(lerLista('um')).toBeNull();
  });

  it('escreve a lista para o campo e explica os erros da janela (RN-59)', () => {
    expect(escreverLista([1, 3, 5])).toBe('1, 3, 5');
    expect(mensagemDoMotivo('sem_dias')).toBe('Marque pelo menos um dia para envio.');
    expect(mensagemDoMotivo('outro')).toBe('Algum valor está fora do permitido.');
  });
});
