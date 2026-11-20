import { expect, test, type Locator, type Page } from '@playwright/test';
import { z } from 'zod';
import { URL_API } from './ambiente';

// S7-3, seção 12, critério 1 (fluxo feliz), no celular: a agência cadastra o cliente; o cliente
// abre o link e conclui as 4 etapas; o onboarding fica com as 4 etapas concluídas, o prazo
// calculado (RN-43/44), a confirmação para o cliente e o aviso de conclusão para a agência.
// Sem evento de calendário (decisão 2026-11-15-a-sem-google-calendar).

const TIPOS = ['reuniao', 'captacao'] as const;
/** Horários de atendimento criados só se a agência de teste não tiver nenhum (CI começa vazia). */
const JANELAS = {
  reuniao: { horaInicio: '09:00', horaFim: '12:00' },
  captacao: { horaInicio: '14:00', horaFim: '18:00' },
} as const;
const DIAS_UTEIS = [1, 2, 3, 4, 5];

const esquemaDisponibilidades = z.object({
  disponibilidades: z.array(z.object({ id: z.string(), tipo: z.enum(TIPOS) })),
});
const esquemaClientes = z.object({
  clientes: z.array(
    z.object({ email: z.string().nullable(), onboarding: z.object({ id: z.string() }).nullable() }),
  ),
});

async function api(caminho: string, metodo = 'GET', corpo?: unknown) {
  const r = await fetch(`${URL_API}${caminho}`, {
    method: metodo,
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
    body: corpo === undefined ? null : JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${metodo} ${caminho} respondeu ${String(r.status)}`);
  return r.status === 204 ? null : (r.json() as Promise<unknown>);
}

const criadas: string[] = [];

/** Garante horários de reunião e de captação; guarda o que criou para apagar no fim. */
async function garantirAgenda(): Promise<void> {
  const { disponibilidades } = esquemaDisponibilidades.parse(await api('/agenda/disponibilidades'));
  for (const tipo of TIPOS) {
    if (disponibilidades.some((d) => d.tipo === tipo)) continue;
    for (const diaSemana of DIAS_UTEIS) {
      const r = z
        .object({ disponibilidade: z.object({ id: z.string() }) })
        .parse(
          await api('/agenda/disponibilidades', 'POST', { tipo, diaSemana, ...JANELAS[tipo] }),
        );
      criadas.push(r.disponibilidade.id);
    }
  }
}

/** Preenche cada campo do formulário do cliente conforme o tipo, para não depender do modelo. */
async function preencherCampos(form: Locator): Promise<void> {
  const valores: Record<string, string> = {
    email: 'contato@exemplo.com',
    tel: '(31) 99999-8888',
    url: 'https://exemplo.com',
    number: '1',
    date: '2026-12-01',
  };
  for (const campo of await form.locator('input, textarea, select').all()) {
    const tipo = (await campo.getAttribute('type')) ?? 'text';
    const tag = await campo.evaluate((el) => el.tagName);
    if (tag === 'SELECT') {
      const opcoes = await campo.locator('option').all();
      const valor = opcoes.length > 1 ? await opcoes[1]?.getAttribute('value') : null;
      if (valor) await campo.selectOption(valor);
    } else if (tipo === 'checkbox' || tipo === 'radio') {
      await campo.check();
    } else if (tipo !== 'hidden' && tipo !== 'submit') {
      await campo.fill(valores[tipo] ?? 'Teste E2E');
    }
  }
}

/** Formulário guiado: responde uma pergunta por vez até o botão de envio aparecer. */
async function preencherFormulario(page: Page): Promise<void> {
  // Os campos são controlados pelo React: preencher antes de a página ficar ativa não vale.
  await page.waitForLoadState('networkidle');
  const form = page.getByRole('region', { name: 'Formulário', exact: true }).locator('form');
  const enviar = form.getByRole('button', { name: 'Enviar respostas' });
  const contador = form.getByText(/^Pergunta \d+ de \d+$/);
  while (!(await enviar.isVisible())) {
    const antes = await contador.textContent();
    await preencherCampos(form);
    await form.getByRole('button', { name: /^(Continuar|Pular)$/ }).click();
    await expect(contador).not.toHaveText(antes ?? '');
  }
  await preencherCampos(form);
  await enviar.click();
}

/** Escolhe o primeiro horário livre e confirma (RN-30 a RN-33). */
async function escolherPrimeiroHorario(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^\d{2}:\d{2}$/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Confirmar horário' }).click();
}

test.describe('S7-3 fluxo feliz (seção 12, critério 1)', () => {
  // Um fluxo só basta para o critério: roda na largura de referência (360px).
  test.skip(({ viewport }) => viewport?.width !== 360, 'roda só no celular de 360px');
  test.setTimeout(120_000);

  test.beforeAll(garantirAgenda);
  test.afterAll(async () => {
    for (const id of criadas) await api(`/agenda/disponibilidades/${id}`, 'DELETE');
  });

  test('o cliente conclui as 4 etapas; prazo, confirmação e aviso de conclusão', async ({
    page,
  }) => {
    const marca = Date.now().toString(36);
    const empresa = `Fluxo Feliz ${marca}`;
    const email = `fluxo-${marca}@exemplo.com`;

    // 1. A agência cadastra o cliente e pega o link (RN-04 a RN-09).
    await page.goto('/clientes/novo');
    await page.getByLabel('Nome da empresa').fill(empresa);
    await page.getByLabel('Nome do contato').fill('Bia');
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Cadastrar cliente' }).click();
    const link = page.getByLabel('Link do cliente');
    await expect(link).toHaveValue(/\/o\//);
    const caminho = new URL(await link.inputValue()).pathname;

    const { clientes } = esquemaClientes.parse(await api('/clientes'));
    const onboardingId = clientes.find((c) => c.email === email)?.onboarding?.id;
    if (!onboardingId) throw new Error('Onboarding do cliente de teste não encontrado');

    // 2. O cliente abre o link e aceita o termo (RN-72).
    await page.goto(caminho);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Aceitar e continuar' }).click();

    // 3. Formulário (RN-17).
    await preencherFormulario(page);
    await expect(page.getByRole('button', { name: 'Formulário: concluída' })).toBeVisible();

    // 4. Acessos: o cliente avisa em cada rede e a agência confirma (RN-27, RN-28).
    const avisar = page.getByRole('button', { name: 'Já adicionei a agência' });
    for (let restantes = await avisar.count(); restantes > 0; restantes--) {
      await avisar.first().click();
      await expect(avisar).toHaveCount(restantes - 1);
    }
    for (const plataforma of ['instagram', 'facebook']) {
      await api(`/onboardings/${onboardingId}/acessos/${plataforma}`, 'PUT', {
        status: 'concedido',
      });
    }

    // 5. Reunião: o primeiro horário livre (RN-79 libera depois dos acessos avisados).
    await page.reload();
    await page.getByRole('button', { name: /^Reunião:/ }).click();
    await escolherPrimeiroHorario(page);
    await expect(page.getByRole('button', { name: 'Reunião: concluída' })).toBeVisible();

    // 6. Captação com local, depois da reunião (RN-38 a RN-40).
    await page.getByRole('button', { name: /^Captação:/ }).click();
    await page.getByLabel('Endereço ou local (obrigatório)').fill('Rua das Flores, 100');
    await escolherPrimeiroHorario(page);
    await expect(page.getByRole('button', { name: 'Captação: concluída' })).toBeVisible();
    await expect(page.getByText('4 de 4 etapas concluídas')).toBeVisible();

    // 7. Na agência: etapas concluídas, prazo calculado e confirmação para o cliente.
    await page.goto(`/onboardings/${onboardingId}`);
    const etapas = page.getByRole('region', { name: 'Etapas' });
    await expect(etapas.getByText('Concluída')).toHaveCount(4);
    const prazo = page.getByRole('region', { name: 'Prazo de liberação' });
    await expect(prazo.getByText('Calculado a partir da data da captação')).toBeVisible();
    const notificacoes = page.getByRole('region', { name: 'Notificações' });
    await expect(notificacoes.getByText('Confirmação com prazo')).toBeVisible();

    // 8. O aviso de conclusão (RN-58).
    await page.goto('/avisos');
    await expect(
      page.getByText(`${empresa} concluiu todas as etapas do onboarding.`),
    ).toBeVisible();
  });
});
