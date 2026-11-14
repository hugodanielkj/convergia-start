import { describe, expect, it, vi } from 'vitest';
import { criarBarramentoEmMemoria } from './eventos.js';

declare module '@convergia/core/base' {
  interface MapaEventos {
    'teste.ocorreu': { valor: number };
  }
}

const evento = (valor: number) => ({
  tipo: 'teste.ocorreu' as const,
  agenciaId: 'ag',
  ocorridoEm: new Date('2026-11-16T12:00:00Z'),
  dados: { valor },
});

describe('barramento de eventos em memória', () => {
  it('entrega o evento a todos os assinantes, em ordem', async () => {
    const recebidos: number[] = [];
    const barramento = criarBarramentoEmMemoria(vi.fn());
    barramento.assinar('teste.ocorreu', async (e) => void recebidos.push(e.dados.valor));
    barramento.assinar('teste.ocorreu', async (e) => void recebidos.push(e.dados.valor * 10));

    await barramento.publicar(evento(1));

    expect(recebidos).toEqual([1, 10]);
  });

  it('falha de um assinante não impede os outros e é reportada', async () => {
    const aoFalhar = vi.fn();
    const segundo = vi.fn(async () => undefined);
    const barramento = criarBarramentoEmMemoria(aoFalhar);
    barramento.assinar('teste.ocorreu', async () => {
      throw new Error('falhou');
    });
    barramento.assinar('teste.ocorreu', segundo);

    await barramento.publicar(evento(2));

    expect(segundo).toHaveBeenCalledOnce();
    expect(aoFalhar).toHaveBeenCalledWith(expect.any(Error), evento(2));
  });

  it('publicar sem assinantes não faz nada', async () => {
    await expect(criarBarramentoEmMemoria(vi.fn()).publicar(evento(3))).resolves.toBeUndefined();
  });
});
