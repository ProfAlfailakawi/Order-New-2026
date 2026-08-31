import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
    },
  },
});
