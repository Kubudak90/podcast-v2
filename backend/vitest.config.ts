import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    env: {
      JWT_SECRET: 'test-secret-key-for-testing-only',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
  },
});
