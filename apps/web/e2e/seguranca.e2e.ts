import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ARQUIVO_DADOS, esquemaDados } from './ambiente';
import { TELAS } from './telas';

// RN-76: cada tela sai com CSP de nonce e nada nela é bloqueado pela política (um script do
// Next sem nonce quebraria a página sem erro visível).

const dados = esquemaDados.parse(JSON.parse(readFileSync(ARQUIVO_DADOS, 'utf8')));

for (const tela of TELAS) {
  test(`${tela.nome}: CSP com nonce e sem bloqueios`, async ({ page }) => {
    const bloqueios: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) bloqueios.push(msg.text());
    });

    const resposta = await page.goto(tela.caminho(dados));
    await page.waitForLoadState('networkidle');

    const cabecalhos = resposta?.headers() ?? {};
    expect(cabecalhos['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+'/);
    expect(cabecalhos['x-frame-options']).toBe('DENY');
    expect(bloqueios, 'nada bloqueado pela CSP').toEqual([]);
  });
}
