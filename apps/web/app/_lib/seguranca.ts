/**
 * Cabeçalhos de segurança das páginas da web (RN-76, decisão 2026-11-14-a-protecoes-link-publico).
 * Funções puras para o `proxy.ts` e os testes. As respostas de /api/* levam os cabeçalhos da API.
 */

export interface OpcoesCsp {
  readonly nonce: string;
  readonly desenvolvimento: boolean;
  readonly producao: boolean;
}

/**
 * CSP com nonce: só roda script que o próprio Next marcou nesta resposta. Em desenvolvimento o
 * React precisa de `unsafe-eval` para mostrar os erros. Estilos inline ficam liberados: o React
 * e o next/font usam atributos `style`, e estilo não executa código.
 */
export function politicaCsp({ nonce, desenvolvimento, producao }: OpcoesCsp): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desenvolvimento ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(producao ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

/**
 * Demais cabeçalhos. `Referrer-Policy: same-origin` impede que o token da URL do cliente vá para
 * outro site num clique em link externo.
 */
export function cabecalhosSeguranca(producao: boolean): Readonly<Record<string, string>> {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    ...(producao ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}

/** Nonce de 128 bits em base64, novo a cada página. */
export function gerarNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
