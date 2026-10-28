import { randomBytes } from 'node:crypto';
import { defineConfig } from 'vitest/config';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || databaseUrl.includes('<password>')) {
  throw new Error('Set TEST_DATABASE_URL to the test Postgres URL before running tests. Do not commit a password.');
}

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./server/test/globalSetup.ts'],
    env: {
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: process.env.AUTH_SECRET || randomBytes(32).toString('hex'),
      APP_ORIGIN: 'http://localhost:3000',
      NODE_ENV: 'test',
    },
  },
});
