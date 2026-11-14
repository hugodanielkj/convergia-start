import { describe, expect, it, vi } from 'vitest';
import { aceitarTermo } from './aceitar-termo';

const opcoes = (status: number) => ({
  baseUrl: 'http://api',
  fetcher: vi.fn().mockResolvedValue(new Response(null, { status })) as unknown as typeof fetch,
});

describe('RN-72 aceitar o termo pela página do cliente', () => {
  it('envia a versão do termo ao token certo', async () => {
    const o = opcoes(201);
    await aceitarTermo('tok en', '2026-11-14', o);
    expect(o.fetcher).toHaveBeenCalledWith(
      'http://api/publico/onboardings/tok%20en/consentimento',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ versao: '2026-11-14' }) }),
    );
  });

  it('201 e 200 (já aceito) contam como aceito', async () => {
    expect(await aceitarTermo('t', 'v', opcoes(201))).toEqual({ tipo: 'aceito' });
    expect(await aceitarTermo('t', 'v', opcoes(200))).toEqual({ tipo: 'aceito' });
  });

  it('409 pede para recarregar o termo; 410 manda para o link expirado', async () => {
    expect(await aceitarTermo('t', 'v', opcoes(409))).toEqual({ tipo: 'termo_mudou' });
    expect(await aceitarTermo('t', 'v', opcoes(410))).toEqual({ tipo: 'expirado' });
  });

  it('qualquer outra falha vira mensagem amigável', async () => {
    expect((await aceitarTermo('t', 'v', opcoes(500))).tipo).toBe('falha');
    const quebrado = {
      baseUrl: 'http://api',
      fetcher: vi.fn().mockRejectedValue(new Error('x')) as unknown as typeof fetch,
    };
    expect((await aceitarTermo('t', 'v', quebrado)).tipo).toBe('falha');
  });
});
