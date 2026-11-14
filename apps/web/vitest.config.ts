import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['app/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['app/**/*.{ts,tsx}'] },
  },
});
