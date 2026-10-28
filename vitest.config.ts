import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./server/test/globalSetup.ts'],
    env: {
      DATABASE_URL: 'postgresql://atom:atom@127.0.0.1:5432/atom_test',
      AUTH_SECRET: 'test-secret-test-secret-test-secret',
      APP_ORIGIN: 'http://localhost:3000',
      NODE_ENV: 'test',
    },
  },
});
