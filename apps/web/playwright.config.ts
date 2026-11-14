import { defineConfig } from '@playwright/test';
import { EMAIL_E2E, PORTA_API, PORTA_WEB, URL_API, URL_WEB } from './e2e/ambiente';

// Testes de celular (decisão 2026-11-14-a-mobile-first). Sobem uma API e uma web próprias nas
// portas 3334 e 3100, com o login de desenvolvimento: não precisam do Google nem mexem no
// `pnpm dev`. Com E2E_BASE_URL e E2E_API_URL, usam servidores já no ar.

const naCi = Boolean(process.env['CI']);
const externo = Boolean(process.env['E2E_BASE_URL']);
const bancoLocal = 'postgresql://convergia:convergia@localhost:55432/convergia';

/** Larguras conferidas. 360px é a referência; 375px é o iPhone comum; 768px, o tablet. */
const LARGURAS = [
  { name: 'celular-360', viewport: { width: 360, height: 800 }, isMobile: true },
  { name: 'celular-375', viewport: { width: 375, height: 812 }, isMobile: true },
  { name: 'tablet-768', viewport: { width: 768, height: 1024 }, isMobile: false },
];

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/preparar.ts',
  fullyParallel: true,
  forbidOnly: naCi,
  retries: naCi ? 1 : 0,
  reporter: naCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: URL_WEB, trace: 'retain-on-failure', locale: 'pt-BR' },
  projects: LARGURAS.map(({ name, viewport, isMobile }) => ({
    name,
    use: { browserName: 'chromium', viewport, isMobile, hasTouch: true, deviceScaleFactor: 2 },
  })),
  webServer: externo
    ? undefined
    : [
        {
          name: 'api',
          command:
            'pnpm --filter @convergia/api db:seed && pnpm --filter @convergia/api exec tsx --conditions=source src/server.ts',
          url: `${URL_API}/health`,
          reuseExistingServer: !naCi,
          timeout: 60_000,
          env: {
            DATABASE_URL: process.env['DATABASE_URL'] ?? bancoLocal,
            API_PORT: String(PORTA_API),
            APP_URL: URL_WEB,
            AUTH_DEV_USUARIO_EMAIL: EMAIL_E2E,
            SEED_ADMIN_EMAIL: EMAIL_E2E,
            SEED_ADMIN_NOME: 'Equipe E2E',
            LOG_LEVEL: 'warn',
            // Tudo vem do mesmo IP local, em paralelo: limites altos para não recusar os testes.
            LIMITE_PUBLICO_POR_IP: '100000',
            LIMITE_PUBLICO_POR_TOKEN: '100000',
            LIMITE_TOKENS_INVALIDOS_POR_IP: '100000',
          },
        },
        {
          name: 'web',
          // Na CI usa o build já feito; no dia a dia, um `next dev` numa pasta própria.
          command: naCi
            ? `pnpm exec next start --port ${String(PORTA_WEB)}`
            : `pnpm exec next dev --port ${String(PORTA_WEB)}`,
          url: `${URL_WEB}/entrar`,
          reuseExistingServer: !naCi,
          timeout: 120_000,
          env: {
            API_URL: URL_API,
            ...(naCi ? {} : { NEXT_DIST_DIR: '.next/e2e' }),
          },
        },
      ],
});
