import { NextResponse, type NextRequest } from 'next/server';
import { cabecalhosSeguranca, gerarNonce, politicaCsp } from './app/_lib/seguranca';

/**
 * Cabeçalhos de segurança de toda página (RN-76). O nonce vai no cabeçalho da requisição para o
 * Next marcar os próprios scripts; por isso todas as páginas são dinâmicas (`app/layout.tsx`).
 */
export function proxy(request: NextRequest) {
  const nonce = gerarNonce();
  const ambiente = process.env.NODE_ENV;
  const csp = politicaCsp({
    nonce,
    desenvolvimento: ambiente === 'development',
    producao: ambiente === 'production',
  });

  const cabecalhosRequisicao = new Headers(request.headers);
  cabecalhosRequisicao.set('x-nonce', nonce);
  cabecalhosRequisicao.set('Content-Security-Policy', csp);

  const resposta = NextResponse.next({ request: { headers: cabecalhosRequisicao } });
  resposta.headers.set('Content-Security-Policy', csp);
  for (const [nome, valor] of Object.entries(cabecalhosSeguranca(ambiente === 'production'))) {
    resposta.headers.set(nome, valor);
  }
  return resposta;
}

export const config = {
  matcher: [
    {
      // /api/* sai com os cabeçalhos da própria API; arquivos estáticos não precisam.
      source: '/((?!api/|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
