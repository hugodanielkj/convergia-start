import * as oidc from 'openid-client';
import type { ProvedorIdentidade } from '../../base/auth.js';

const EMISSOR_GOOGLE = new URL('https://accounts.google.com');

export interface ConfigGoogle {
  clientId: string;
  clientSecret: string;
  /** Precisa ser idêntica à cadastrada no Google Cloud Console. */
  urlRetorno: string;
}

/**
 * Login com Google via OpenID Connect (D-21), com state, nonce e PKCE.
 * `descobrir` é injetável para testes; por padrão consulta a configuração pública do Google.
 */
export function criarProvedorGoogle(
  config: ConfigGoogle,
  descobrir: () => Promise<oidc.Configuration> = () =>
    oidc.discovery(EMISSOR_GOOGLE, config.clientId, config.clientSecret),
): ProvedorIdentidade {
  let configuracao: Promise<oidc.Configuration> | undefined;
  const obter = () => {
    configuracao ??= descobrir().catch((erro: unknown) => {
      configuracao = undefined; // tenta de novo na próxima requisição
      throw erro;
    });
    return configuracao;
  };

  return {
    async urlAutorizacao({ state, nonce, codeChallenge }) {
      return oidc.buildAuthorizationUrl(await obter(), {
        redirect_uri: config.urlRetorno,
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
    },

    async concluir(urlRetorno, { state, nonce, codeVerifier }) {
      const tokens = await oidc.authorizationCodeGrant(await obter(), urlRetorno, {
        expectedState: state,
        expectedNonce: nonce,
        pkceCodeVerifier: codeVerifier,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims || typeof claims['email'] !== 'string') {
        throw new Error('Google não retornou e-mail');
      }
      return {
        email: claims['email'],
        emailVerificado: claims['email_verified'] === true,
        nome: typeof claims['name'] === 'string' ? claims['name'] : null,
      };
    },
  };
}
