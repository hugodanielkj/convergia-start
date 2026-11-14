export type EstadoPedido =
  | { readonly tipo: 'inicial' }
  | { readonly tipo: 'registrado' }
  | { readonly tipo: 'link_valido' }
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'falha'; readonly mensagem: string };

export interface OpcoesPedido {
  readonly baseUrl: string;
  readonly fetcher: typeof fetch;
}

const FALHA = 'Não foi possível enviar o pedido agora. Tente de novo em instantes.';

/**
 * Pede à agência um novo link (RN-11). Rota pública da API, sem login: o token da URL é a
 * credencial. A resposta nunca traz um link novo; quem gera e entrega é a agência (RN-12).
 */
export async function pedirNovoLink(
  token: string,
  { baseUrl, fetcher }: OpcoesPedido,
): Promise<EstadoPedido> {
  try {
    const resposta = await fetcher(
      `${baseUrl}/publico/onboardings/${encodeURIComponent(token)}/solicitar-novo-link`,
      { method: 'POST', cache: 'no-store' },
    );
    switch (resposta.status) {
      // Pedido novo e pedido repetido parecem iguais para o cliente.
      case 202:
        return { tipo: 'registrado' };
      case 409:
        return { tipo: 'link_valido' };
      case 404:
        return { tipo: 'invalido' };
      default:
        return { tipo: 'falha', mensagem: FALHA };
    }
  } catch {
    return { tipo: 'falha', mensagem: FALHA };
  }
}
