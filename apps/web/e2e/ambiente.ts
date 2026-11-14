import path from 'node:path';
import { z } from 'zod';

/** Portas próprias dos testes: não brigam com o `pnpm dev` (3000 e 3333). */
export const PORTA_WEB = 3100;
export const PORTA_API = 3334;

/** Usuário do login de desenvolvimento da API (AUTH_DEV_USUARIO_EMAIL), criado pelo seed. */
export const EMAIL_E2E = 'e2e@convergia.test';

export const URL_WEB = process.env['E2E_BASE_URL'] ?? `http://localhost:${String(PORTA_WEB)}`;
export const URL_API = process.env['E2E_API_URL'] ?? `http://localhost:${String(PORTA_API)}`;

/** Dados criados pelo `preparar.ts` e lidos pelos testes. Em .next: fora do git e do Prettier. */
export const ARQUIVO_DADOS = path.join(import.meta.dirname, '..', '.next', 'e2e-dados.json');

export const esquemaDados = z.object({
  /** Link de um cliente que já aceitou o termo: abre nas etapas. */
  token: z.string(),
  /** Link de um cliente que ainda não aceitou o termo: abre no consentimento. */
  tokenSemTermo: z.string(),
  onboardingId: z.string(),
});

export type DadosE2E = z.infer<typeof esquemaDados>;
