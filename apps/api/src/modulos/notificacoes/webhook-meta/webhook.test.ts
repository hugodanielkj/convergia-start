import { describe, expect, it } from 'vitest';
import { assinar, assinaturaValida } from './assinatura.js';
import { eventosDoPayload } from './eventos-meta.js';

describe('RN-61 assinatura do webhook da Meta', () => {
  const corpo = Buffer.from('{"entry":[]}');
  it('aceita a assinatura correta e recusa errada, ausente ou de outro segredo', () => {
    expect(assinaturaValida(corpo, assinar(corpo, 'segredo'), 'segredo')).toBe(true);
    expect(assinaturaValida(corpo, assinar(corpo, 'outro'), 'segredo')).toBe(false);
    expect(assinaturaValida(corpo, undefined, 'segredo')).toBe(false);
    expect(assinaturaValida(corpo, 'sha256=zz', 'segredo')).toBe(false);
    expect(assinaturaValida(Buffer.from('{}'), assinar(corpo, 'segredo'), 'segredo')).toBe(false);
  });
});

describe('RN-61, RN-62 eventos do webhook', () => {
  const payload = (value: unknown) => ({ entry: [{ changes: [{ value }] }] });
  it('extrai falhas de entrega e pedidos de PARAR; ignora entregue/lido e o resto', () => {
    const r = eventosDoPayload(
      payload({
        statuses: [
          { id: 'w1', status: 'delivered' },
          { id: 'w2', status: 'read' },
          { id: 'w3', status: 'failed', errors: [{ code: 131026 }] },
        ],
        messages: [
          { from: '5531999998888', type: 'text', text: { body: ' Parar. ' } },
          { from: '5531888887777', type: 'text', text: { body: 'olá, tudo bem?' } },
          { from: '5531777776666', type: 'image' },
        ],
      }),
    );
    expect(r).toEqual({
      falhas: [{ idExterno: 'w3', codigo: 131026 }],
      optOuts: ['5531999998888'],
    });
  });
  it('payload desconhecido não quebra', () => {
    expect(eventosDoPayload('lixo')).toEqual({ falhas: [], optOuts: [] });
  });
});
