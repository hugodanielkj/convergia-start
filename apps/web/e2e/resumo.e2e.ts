import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ARQUIVO_DADOS, esquemaDados } from './ambiente';
import { ETAPAS } from './telas';

// RN-14: depois da conclusão, o link mostra só o resumo, mesmo vencido e sem pedir novo link.

const dados = esquemaDados.parse(JSON.parse(readFileSync(ARQUIVO_DADOS, 'utf8')));

test('o link de um onboarding concluído, mesmo vencido, abre o resumo só para leitura', async ({
  page,
}) => {
  await page.goto(`/o/${dados.tokenConcluido}`);

  await expect(page).toHaveURL(new RegExp(`/o/${dados.tokenConcluido}/resumo$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tudo pronto');
  for (const etapa of ETAPAS) {
    await expect(page.getByRole('listitem').filter({ hasText: etapa })).toBeVisible();
  }
  await expect(page.getByText('Primeiro conteúdo entregue')).toBeVisible();
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
});

test('o resumo de um onboarding em andamento volta para as etapas', async ({ page }) => {
  await page.goto(`/o/${dados.token}/resumo`);

  await expect(page).toHaveURL(new RegExp(`/o/${dados.token}$`));
});
