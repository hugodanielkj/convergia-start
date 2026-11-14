import { defineConfig } from 'prisma/config';

// Prisma 7 não carrega .env sozinho. Usa o .env da raiz do monorepo, se existir.
try {
  process.loadEnvFile('../../.env');
} catch {
  // Sem .env (CI, Docker): variáveis já vêm do ambiente.
}

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --conditions=source prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? '',
  },
});
