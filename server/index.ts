import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './http/app';
import { prisma } from './db';

const secret = process.env.AUTH_SECRET || '';
const databaseUrl = process.env.DATABASE_URL || '';
const placeholder = (value: string) => value.includes('change-me') || value.includes('<password>') || value.includes('<long-random-string>');
if (secret.length < 24 || (process.env.NODE_ENV === 'production' && placeholder(secret))) {
  console.error('Set AUTH_SECRET to a long random string before starting the API.');
  process.exit(1);
}
if (!databaseUrl || (process.env.NODE_ENV === 'production' && placeholder(databaseUrl))) {
  console.error('Set DATABASE_URL to this box’s Postgres URL before starting the API.');
  process.exit(1);
}

const port = Number(process.env.PORT || 8787);
const hostname = process.env.HOST || '0.0.0.0';
const app = createApp(prisma);

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`ATOM api listening on http://${info.address}:${info.port} (paper / read-only)`);
});
