import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './http/app';
import { prisma } from './db';

const secret = process.env.AUTH_SECRET || '';
if (process.env.NODE_ENV === 'production') {
  if (secret.length < 24 || secret.includes('change-me')) {
    console.error('Refusing to start. Set AUTH_SECRET to a long random string that is not the example value.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('change-me')) {
    console.error('Refusing to start. Set DATABASE_URL to the Postgres instance for this box.');
    process.exit(1);
  }
} else if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = 'dev-only-atom-secret-change-me';
  console.warn('AUTH_SECRET is unset. Using a development-only default.');
}

const port = Number(process.env.PORT || 8787);
const hostname = process.env.HOST || '0.0.0.0';
const app = createApp(prisma);

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`ATOM api listening on http://${info.address}:${info.port} (paper / read-only)`);
});
