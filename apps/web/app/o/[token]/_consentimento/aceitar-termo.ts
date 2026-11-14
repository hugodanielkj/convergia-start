export type EstadoAceite =
  | { readonly tipo: 'inicial' }
  | { readonly tipo: 'aceito' }
  | { readonly tipo: 'termo_mudou' }
  | { readonly tipo: 'expirado' }
  | { readonly tipo: 'falha'; readonly mensagem: string };

export interface OpcoesAceite {
  readonly baseUrl: string;
  readonly fetcher: typeof fetch;
}

const FALHA = 'Não foi possível registrar agora. Tente de novo em instantes.';

/** Registra o aceite do termo (RN-72). Rota pública da API: o token da URL é a credencial. */
export async function aceitarTermo(
  token: string,
  versao: string,
  { baseUrl, fetcher }: OpcoesAceite,
): Promise<EstadoAceite> {
  try {
    const resposta = await fetcher(
      `${baseUrl}/publico/onboardings/${encodeURIComponent(token)}/consentimento`,
      {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ versao }),
      },
    );
    switch (resposta.status) {
      case 200:
      case 201:
        return { tipo: 'aceito' };
      case 409:
        return { tipo: 'termo_mudou' };
      case 410:
        return { tipo: 'expirado' };
      default:
        return { tipo: 'falha', mensagem: FALHA };
    }
  } catch {
    return { tipo: 'falha', mensagem: FALHA };
  }
}
