import { describe, expect, it } from 'vitest';
import { aplicarEscopo } from './escopo-agencia.js';

describe('RN-75 escopo de agência (regras de reescrita)', () => {
  it('adiciona agenciaId ao filtro de leituras e escritas por where', () => {
    for (const op of ['findMany', 'findUnique', 'count', 'update', 'deleteMany']) {
      expect(aplicarEscopo(op, { where: { id: '1' } }, 'A')).toEqual({
        where: { id: '1', agenciaId: 'A' },
      });
    }
  });

  it('cria filtro quando a operação não tinha where', () => {
    expect(aplicarEscopo('findMany', {}, 'A')).toEqual({ where: { agenciaId: 'A' } });
  });

  it('sobrescreve agenciaId de outra agência no filtro', () => {
    expect(aplicarEscopo('findFirst', { where: { agenciaId: 'B' } }, 'A')).toEqual({
      where: { agenciaId: 'A' },
    });
  });

  it('grava agenciaId em create, createMany e upsert', () => {
    expect(aplicarEscopo('create', { data: { nome: 'x', agenciaId: 'B' } }, 'A')).toEqual({
      data: { nome: 'x', agenciaId: 'A' },
    });
    expect(aplicarEscopo('createMany', { data: [{ n: 1 }, { n: 2 }] }, 'A')).toEqual({
      data: [
        { n: 1, agenciaId: 'A' },
        { n: 2, agenciaId: 'A' },
      ],
    });
    expect(aplicarEscopo('createManyAndReturn', { data: { n: 1 } }, 'A')).toEqual({
      data: [{ n: 1, agenciaId: 'A' }],
    });
    expect(aplicarEscopo('upsert', { where: { id: '1' }, create: {}, update: {} }, 'A')).toEqual({
      where: { id: '1', agenciaId: 'A' },
      create: { agenciaId: 'A' },
      update: {},
    });
  });

  it('recusa operação desconhecida em vez de deixar passar sem escopo', () => {
    expect(() => aplicarEscopo('operacaoNova', {}, 'A')).toThrow(/não suportada/);
  });
});
