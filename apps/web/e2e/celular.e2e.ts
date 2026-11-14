import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ARQUIVO_DADOS, esquemaDados } from './ambiente';
import { ETAPAS, TELAS } from './telas';
import { esperarTelaMobileFirst } from './verificar';

// Decisão mobile-first (2026-11-14-a-mobile-first): cada tela, em cada largura do
// playwright.config.ts, sem rolagem horizontal, com toque ≥ 44px e campos ≥ 16px.

const dados = esquemaDados.parse(JSON.parse(readFileSync(ARQUIVO_DADOS, 'utf8')));

for (const tela of TELAS) {
  test(`${tela.nome}: sem rolagem lateral, toque ≥ 44px e campos ≥ 16px`, async ({ page }) => {
    const resposta = await page.goto(tela.caminho(dados));
    expect(resposta?.status(), 'a tela abre sem erro').toBeLessThan(400);
    await tela.abrir?.(page);
    await esperarTelaMobileFirst(page);
  });
}

test('o menu do painel mostra todos os itens inteiros', async ({ page }) => {
  await page.goto('/onboardings');
  const menu = page.getByRole('navigation', { name: 'Menu principal' });
  const abrirMenu = page.getByRole('button', { name: 'Menu' });
  if (await abrirMenu.isVisible()) await abrirMenu.click();
  const largura = page.viewportSize()?.width ?? 0;
  for (const item of await menu.getByRole('link').all()) {
    await expect(item).toBeVisible();
    const caixa = await item.boundingBox();
    expect(caixa?.x ?? -1, 'item começa dentro da tela').toBeGreaterThanOrEqual(0);
    expect(
      (caixa?.x ?? 0) + (caixa?.width ?? 0),
      'item termina dentro da tela',
    ).toBeLessThanOrEqual(largura);
  }
});

test('as 4 etapas do cliente cabem no celular, inclusive a bloqueada', async ({ page }) => {
  await page.goto(`/o/${dados.token}`);
  const navegacao = page.getByRole('navigation', { name: 'Etapas' });
  for (const etapa of ETAPAS) {
    await navegacao.getByRole('button', { name: new RegExp(`^${etapa}`) }).click();
    await expect(page.getByRole('region', { name: etapa, exact: true }).first()).toBeVisible();
    await esperarTelaMobileFirst(page);
  }
});
