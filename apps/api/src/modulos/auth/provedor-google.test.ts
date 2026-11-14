import * as oidc from 'openid-client';
import { describe, expect, it, vi } from 'vitest';
import { criarProvedorGoogle } from './provedor-google.js';

const config = {
  clientId: 'id-cliente',
  clientSecret: 'segredo',
  urlRetorno: 'http://localhost:3000/api/auth/google/callback',
};

const configuracaoGoogle = () =>
  new oidc.Configuration(
    {
      issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_endpoint: 'https://oauth2.googleapis.com/token',
    },
    config.clientId,
    config.clientSecret,
  );

describe('provedor Google', () => {
  it('monta a URL de autorização com state, nonce e PKCE S256', async () => {
    const provedor = criarProvedorGoogle(config, () => Promise.resolve(configuracaoGoogle()));
    const url = await provedor.urlAutorizacao({ state: 's1', nonce: 'n1', codeChallenge: 'c1' });

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'id-cliente',
      redirect_uri: config.urlRetorno,
      response_type: 'code',
      scope: 'openid email profile',
      state: 's1',
      nonce: 'n1',
      code_challenge: 'c1',
      code_challenge_method: 'S256',
    });
  });

  it('consulta a configuração do Google uma vez só', async () => {
    const descobrir = vi.fn(() => Promise.resolve(configuracaoGoogle()));
    const provedor = criarProvedorGoogle(config, descobrir);
    const params = { state: 's', nonce: 'n', codeChallenge: 'c' };
    await provedor.urlAutorizacao(params);
    await provedor.urlAutorizacao(params);
    expect(descobrir).toHaveBeenCalledOnce();
  });

  it('tenta descobrir de novo depois de uma falha de rede', async () => {
    const descobrir = vi
      .fn<() => Promise<oidc.Configuration>>()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValue(configuracaoGoogle());
    const provedor = criarProvedorGoogle(config, descobrir);
    const params = { state: 's', nonce: 'n', codeChallenge: 'c' };

    await expect(provedor.urlAutorizacao(params)).rejects.toThrow('rede');
    await expect(provedor.urlAutorizacao(params)).resolves.toBeInstanceOf(URL);
    expect(descobrir).toHaveBeenCalledTimes(2);
  });
});
