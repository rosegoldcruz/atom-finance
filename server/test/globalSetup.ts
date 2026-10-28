import { execSync } from 'node:child_process';

export default function setup(): void {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('<password>')) {
    throw new Error('Set TEST_DATABASE_URL to the test Postgres URL before running tests. Do not commit a password.');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}
