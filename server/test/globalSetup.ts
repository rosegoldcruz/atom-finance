import { execSync } from 'node:child_process';

export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://atom:atom@127.0.0.1:5432/atom_test',
    },
  });
}
