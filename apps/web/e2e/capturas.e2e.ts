import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { ARQUIVO_DADOS, esquemaDados } from './ambiente';
import { ETAPAS, TELAS } from './telas';

// Fotos das telas para comparar antes e depois (demonstração ao PO). Só roda com
// E2E_CAPTURAS=<pasta>: `E2E_CAPTURAS=depois pnpm test:e2e capturas`. Fica fora do git.

const pasta = process.env['E2E_CAPTURAS'];
const dados = esquemaDados.parse(JSON.parse(readFileSync(ARQUIVO_DADOS, 'utf8')));
const destino = (projeto: string, nome: string): string =>
  path.join(
    import.meta.dirname,
    'capturas',
    pasta ?? '',
    `${projeto}-${nome.replace(/[^\p{L}\d]+/gu, '-')}.png`,
  );

test.skip(!pasta, 'defina E2E_CAPTURAS para tirar as fotos');

for (const tela of TELAS) {
  test(`foto: ${tela.nome}`, async ({ page }, info) => {
    await page.goto(tela.caminho(dados));
    await tela.abrir?.(page);
    await page.screenshot({ path: destino(info.project.name, tela.nome), fullPage: true });
  });
}

test('foto: etapas do cliente', async ({ page }, info) => {
  await page.goto(`/o/${dados.token}`);
  for (const etapa of ETAPAS) {
    await page
      .getByRole('navigation', { name: 'Etapas' })
      .getByRole('button', { name: new RegExp(`^${etapa}`) })
      .click();
    await page.screenshot({ path: destino(info.project.name, `etapa-${etapa}`), fullPage: true });
  }
});
