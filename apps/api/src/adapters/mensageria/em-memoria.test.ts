import { describe, expect, it } from 'vitest';
import { MensageriaEmMemoria } from './em-memoria.js';

describe('MensageriaEmMemoria', () => {
  it('guarda as mensagens e devolve ids sequenciais', async () => {
    const mensageria = new MensageriaEmMemoria();
    const msg = { canal: 'email' as const, destinatario: 'a@b.com', corpo: 'Olá' };

    expect(await mensageria.enviar(msg)).toEqual({ ok: true, idExterno: 'memoria-1' });
    expect(await mensageria.enviar(msg)).toEqual({ ok: true, idExterno: 'memoria-2' });
    expect(mensageria.enviadas).toHaveLength(2);
  });
});
