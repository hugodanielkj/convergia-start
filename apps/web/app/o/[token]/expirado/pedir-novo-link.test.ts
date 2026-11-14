import { describe, expect, it, vi } from 'vitest';
import { pedirNovoLink } from './pedir-novo-link';

function api(status: number, corpo?: unknown) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(corpo === undefined ? null : JSON.stringify(corpo), { status })),
  );
}

const opcoes = (fetcher: typeof fetch) => ({ baseUrl: 'http://api', fetcher });

describe('RN-11 pedido de novo link pelo cliente', () => {
  it('registra o pedido na API, com o token só no caminho', async () => {
    const fetcher = api(202, { situacao: 'registrada' });
    expect(await pedirNovoLink('tok-1', opcoes(fetcher))).toEqual({ tipo: 'registrado' });
    expect(fetcher).toHaveBeenCalledWith(
      'http://api/publico/onboardings/tok-1/solicitar-novo-link',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    );
  });

  it('tratar pedido repetido como sucesso, sem assustar o cliente', async () => {
    expect(await pedirNovoLink('tok', opcoes(api(202, { situacao: 'ja_solicitada' })))).toEqual({
      tipo: 'registrado',
    });
  });

  it('avisa quando o link ainda é válido', async () => {
    expect(await pedirNovoLink('tok', opcoes(api(409, { erro: 'LINK_VALIDO' })))).toEqual({
      tipo: 'link_valido',
    });
  });

  it('avisa quando o link não vale mais, sem dizer se existiu', async () => {
    expect(await pedirNovoLink('tok', opcoes(api(404, { erro: 'LINK_INVALIDO' })))).toEqual({
      tipo: 'invalido',
    });
  });

  it('codifica o token para não escapar do caminho', async () => {
    const fetcher = api(404);
    await pedirNovoLink('a/b?c', opcoes(fetcher));
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'http://api/publico/onboardings/a%2Fb%3Fc/solicitar-novo-link',
    );
  });

  it.each([500, 502, 429])(
    'trata erro %i do servidor como falha para tentar de novo',
    async (status) => {
      expect(await pedirNovoLink('tok', opcoes(api(status)))).toMatchObject({ tipo: 'falha' });
    },
  );

  it('trata queda de rede como falha', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.reject(new Error('ECONNREFUSED')));
    expect(await pedirNovoLink('tok', opcoes(fetcher))).toMatchObject({
      tipo: 'falha',
      mensagem: expect.stringMatching(/Não foi possível/) as string,
    });
  });
});
