import { describe, expect, it } from 'vitest';
import { cabecalhosSeguranca, gerarNonce, politicaCsp } from './seguranca';

describe('RN-76 cabeçalhos de segurança da web', () => {
  it('CSP de produção só aceita script com o nonce da página, sem eval nem iframe', () => {
    const csp = politicaCsp({ nonce: 'abc', desenvolvimento: false, producao: true });

    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('em desenvolvimento libera eval para o React mostrar erros e não força HTTPS', () => {
    const csp = politicaCsp({ nonce: 'abc', desenvolvimento: true, producao: false });

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('HSTS só em produção; o token da URL não vaza como referrer', () => {
    expect(cabecalhosSeguranca(true)['Strict-Transport-Security']).toBeDefined();
    expect(cabecalhosSeguranca(false)['Strict-Transport-Security']).toBeUndefined();
    expect(cabecalhosSeguranca(false)['Referrer-Policy']).toBe('same-origin');
    expect(cabecalhosSeguranca(false)['X-Frame-Options']).toBe('DENY');
  });

  it('gera um nonce diferente a cada página', () => {
    const nonces = new Set(Array.from({ length: 50 }, gerarNonce));
    expect(nonces.size).toBe(50);
    expect(Buffer.from(gerarNonce(), 'base64')).toHaveLength(16);
  });
});
