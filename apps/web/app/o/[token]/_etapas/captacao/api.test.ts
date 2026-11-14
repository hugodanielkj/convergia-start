import { describe, expect, it } from 'vitest';
import { buscarPrazo } from './api';

const responder =
  (status: number, corpo: unknown): typeof fetch =>
  () =>
    Promise.resolve(new Response(JSON.stringify(corpo), { status }));

describe('RN-45 prazo na página do cliente', () => {
  it('devolve a data quando o prazo está definido', async () => {
    const prazo = await buscarPrazo(
      '/api',
      'tok',
      responder(200, { definido: true, data: '2026-11-26' }),
    );
    expect(prazo).toEqual({ definido: true, data: '2026-11-26' });
  });

  it('mostra "a definir" antes da captação', async () => {
    expect(await buscarPrazo('/api', 'tok', responder(200, { definido: false }))).toEqual({
      definido: false,
    });
  });

  it('falha de rede ou resposta estranha não quebra a etapa', async () => {
    const falha = (() => Promise.reject(new Error('rede'))) as typeof fetch;
    expect(await buscarPrazo('/api', 'tok', falha)).toEqual({ definido: false });
    expect(await buscarPrazo('/api', 'tok', responder(200, { definido: true }))).toEqual({
      definido: false,
    });
    expect(await buscarPrazo('/api', 'tok', responder(410, {}))).toEqual({ definido: false });
  });
});
