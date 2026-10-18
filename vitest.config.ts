import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['app/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['app/**/*.{ts,vue}'],
      exclude: ['app/**/*.test.ts', 'app/api/generated.ts', 'app/app.vue', 'app/pages/**'],
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70,
        // Critical modules (API client, auth, i18n, money and date formatting).
        'app/api/**': { lines: 85, branches: 85, functions: 85, statements: 85 },
      },
    },
  },
});
