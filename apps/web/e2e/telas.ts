import type { Page } from '@playwright/test';
import type { DadosE2E } from './ambiente';

/**
 * Telas conferidas no celular. **Tela nova entra aqui** (regra .claude/rules/ui-mobile.md).
 * `abrir` deixa visível o que fica recolhido (seções em <details>, por exemplo).
 */
export interface Tela {
  nome: string;
  caminho: (dados: DadosE2E) => string;
  abrir?: (page: Page) => Promise<void>;
}

async function abrirSecoes(page: Page): Promise<void> {
  const fechadas = page.locator('details:not([open]) > summary');
  // Abrir uma seção pode revelar outras: abre a primeira fechada até não sobrar nenhuma.
  for (let i = 0; i < 20 && (await fechadas.count()) > 0; i++) {
    await fechadas.first().click();
  }
}

export const TELAS: readonly Tela[] = [
  { nome: 'entrar', caminho: () => '/entrar' },
  { nome: 'início', caminho: () => '/' },
  { nome: 'onboardings', caminho: () => '/onboardings' },
  { nome: 'avisos', caminho: () => '/avisos' },
  { nome: 'avisos resolvidos', caminho: () => '/avisos?situacao=resolvidos' },
  { nome: 'detalhe do onboarding', caminho: (d) => `/onboardings/${d.onboardingId}` },
  {
    nome: 'acessos do onboarding',
    caminho: (d) => `/onboardings/${d.onboardingId}/acessos`,
  },
  {
    nome: 'personalizar onboarding',
    caminho: (d) => `/onboardings/${d.onboardingId}/personalizar`,
    abrir: abrirSecoes,
  },
  { nome: 'clientes', caminho: () => '/clientes' },
  { nome: 'novo cliente', caminho: () => '/clientes/novo', abrir: abrirSecoes },
  { nome: 'configurações', caminho: () => '/config' },
  { nome: 'config: acessos', caminho: () => '/config/acessos' },
  { nome: 'config: agenda', caminho: () => '/config/agenda' },
  {
    nome: 'config: agenda (mês, dia aberto)',
    caminho: () => {
      const dia = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return `/config/agenda?visao=mes&data=${dia}&dia=${dia}`;
    },
    abrir: abrirSecoes,
  },
  { nome: 'config: formulário', caminho: () => '/config/formulario' },
  { nome: 'config: mensagens', caminho: () => '/config/templates' },
  { nome: 'config: lembretes', caminho: () => '/config/lembretes' },
  { nome: 'config: equipe', caminho: () => '/config/equipe' },
  { nome: 'config: geral', caminho: () => '/config/geral' },
  { nome: 'cliente: termo', caminho: (d) => `/o/${d.tokenSemTermo}` },
  { nome: 'cliente: link expirado', caminho: (d) => `/o/${d.token}/expirado` },
  { nome: 'cliente: resumo', caminho: (d) => `/o/${d.tokenConcluido}/resumo` },
  { nome: 'parar lembretes', caminho: () => '/parar-lembretes/token-invalido' },
];

/** As 4 etapas da página do cliente, abertas pelos botões do topo. */
export const ETAPAS = ['Formulário', 'Acessos', 'Reunião', 'Captação'] as const;
