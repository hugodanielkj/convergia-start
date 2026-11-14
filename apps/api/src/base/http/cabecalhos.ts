import type { FastifyInstance } from 'fastify';

/**
 * A API só responde JSON, redirecionamentos e arquivos baixados. Nada dela deve rodar script,
 * carregar recurso ou ser embutido em outra página: CSP fechada e `sandbox` também impedem que um
 * arquivo enviado (ex.: SVG ou HTML) execute algo se for aberto direto (RN-76).
 */
const CABECALHOS_FIXOS: Readonly<Record<string, string>> = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; sandbox",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

const HSTS = 'max-age=31536000; includeSubDomains';

/** Cabeçalhos de segurança em toda resposta da API. */
export function registrarCabecalhos(app: FastifyInstance, hsts: boolean): void {
  app.addHook('onSend', async (request, reply) => {
    reply.headers(CABECALHOS_FIXOS);
    if (hsts) reply.header('strict-transport-security', HSTS);
    // Respostas do link trazem dados de um cliente: nenhum cache intermediário guarda.
    if (request.url.startsWith('/publico/') && !reply.hasHeader('cache-control')) {
      reply.header('cache-control', 'no-store');
    }
  });
}
