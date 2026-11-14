// Rotas em que um segmento da URL é o token do link do cliente (RN-10). O token é credencial:
// não pode ir para os logs (rules/seguranca.md). Rotas novas com token entram aqui.
const ROTAS_COM_TOKEN =
  /^(\/publico\/onboardings\/|\/publico\/lembretes\/|\/o\/|\/parar-lembretes\/)[^/?#]+/;

/** Troca o token por `:token` numa URL, preservando o resto do caminho e a query. */
export function mascararTokens(url: string): string {
  return url.replace(ROTAS_COM_TOKEN, '$1:token');
}

interface RequisicaoLogavel {
  readonly method: string;
  readonly url: string;
  readonly ip: string;
}

/** Serializador de `req` do logger: sem cabeçalhos (cookies) e sem token na URL. */
export function serializarRequisicao(requisicao: RequisicaoLogavel) {
  return {
    method: requisicao.method,
    url: mascararTokens(requisicao.url),
    remoteAddress: requisicao.ip,
  };
}
