import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { parseCsv, roundTripCostSol } from '../domain/paper';

const fixturePassword = randomBytes(18).toString('base64url');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prisma = new PrismaClient();
const app = createApp(prisma);

const ledger = parseCsv(readFileSync(path.join(root, 'data/samples/paper_ledger.csv'), 'utf8'));
const opportunities = parseCsv(readFileSync(path.join(root, 'data/samples/opportunities.csv'), 'utf8'));
const circular = parseCsv(readFileSync(path.join(root, 'data/samples/circular.csv'), 'utf8'));
const config = JSON.parse(readFileSync(path.join(root, 'data/samples/scanner.config.json'), 'utf8')) as {
  costs: { base_fee_per_sig_sol: number; signatures: number; priority_or_tip_per_leg_sol: number; legs: number };
};

beforeAll(async () => {
  await prisma.liquidationObservation.deleteMany();
  await prisma.borrowerSnapshot.deleteMany();
  await prisma.scannerHeartbeat.deleteMany();
  await prisma.circularQuote.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.paperTrade.deleteMany();
  await prisma.ingestionBatch.deleteMany();
  await prisma.ingestionKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

test('auth, ingest, and dashboard use the sample ledger and isolate workspaces', async () => {
  const registered = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'operator@atom.local',
      password: fixturePassword,
      name: 'Operator',
      workspaceName: 'Sample desk',
    }),
  });
  expect(registered.status).toBe(201);
  const created = (await registered.json()) as {
    ingestionKey: string;
    user: { email: string };
    workspace: { plan: string };
  };
  expect(created.user.email).toBe('operator@atom.local');
  expect(created.workspace.plan).toBe('observer');
  expect(created.ingestionKey.startsWith('atom_')).toBe(true);
  const cookie = cookieHeader(registered);

  const me = await app.request('/api/session', { headers: { cookie } });
  expect(me.status).toBe(200);

  const ingest = await app.request('/api/ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${created.ingestionKey}`,
    },
    body: JSON.stringify({
      source: 'sample-logs',
      batches: [
        { kind: 'paper_ledger', rows: ledger },
        { kind: 'opportunities', rows: opportunities },
        { kind: 'circular', rows: circular },
      ],
    }),
  });
  expect(ingest.status).toBe(200);
  const ingested = (await ingest.json()) as {
    results: Array<{ kind: string; inserted: number; received: number }>;
  };
  const paperResult = ingested.results.find((result) => result.kind === 'paper_ledger');
  expect(paperResult).toMatchObject({ received: 5, inserted: 5 });

  const again = await app.request('/api/ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${created.ingestionKey}`,
    },
    body: JSON.stringify({ source: 'sample-logs', batches: [{ kind: 'paper_ledger', rows: ledger }] }),
  });
  const replay = (await again.json()) as { results: Array<{ inserted: number; skipped: number }> };
  expect(replay.results[0]).toMatchObject({ inserted: 0, skipped: 5 });

  const dashboardResponse = await app.request('/api/dashboard?day=2026-10-27', { headers: { cookie } });
  expect(dashboardResponse.status).toBe(200);
  const dashboard = (await dashboardResponse.json()) as {
    caveat: string;
    timezone: string;
    kpis: { dayTrades: number; dayTenX: number; dayNetUsd: number; quotedRoutes: number; netPositiveQuotes: number };
    byPair: Array<{ pair: string }>;
  };
  expect(dashboard.timezone).toBe('America/Phoenix');
  expect(dashboard.caveat.toLowerCase()).toContain('no trade was executed');
  expect(dashboard.kpis.dayTrades).toBe(5);
  expect(dashboard.kpis.dayTenX).toBe(1);
  expect(dashboard.kpis.dayNetUsd).toBeCloseTo(3.69568, 4);
  expect(dashboard.kpis.quotedRoutes).toBe(985);
  expect(dashboard.kpis.netPositiveQuotes).toBe(0);
  expect(dashboard.byPair.map((row) => row.pair).sort()).toEqual(['SOL/USDC', 'SOL/USDT']);

  const today = await app.request('/api/dashboard?day=2026-10-28', { headers: { cookie } });
  const todayBody = (await today.json()) as { kpis: { dayTrades: number; dayNetUsd: number } };
  expect(todayBody.kpis.dayTrades).toBe(0);
  expect(todayBody.kpis.dayNetUsd).toBe(0);

  const strategies = await app.request('/api/strategies', { headers: { cookie } });
  const strategyBody = (await strategies.json()) as {
    strategies: Array<{ id: string; metrics: { quoted: number | null; netPositive: number | null; paperTrades: number | null } }>;
  };
  const dex = strategyBody.strategies.find((item) => item.id === 'single-dex');
  const jup = strategyBody.strategies.find((item) => item.id === 'jupiter-circular');
  const aave = strategyBody.strategies.find((item) => item.id === 'aave-v3-watch');
  expect(dex?.metrics).toMatchObject({ quoted: 985, netPositive: 0, paperTrades: 0 });
  expect(jup?.metrics.quoted).toBe(83);
  expect(jup?.metrics.netPositive).toBe(5);
  expect(jup?.metrics.paperTrades).toBe(5);
  expect(aave?.metrics).toMatchObject({ quoted: null, netPositive: null, paperTrades: null });

  const liquidations = await app.request('/api/liquidations', { headers: { cookie } });
  const liquidationBody = (await liquidations.json()) as {
    monitor: { status: string };
    borrowers: unknown[];
    liquidations: unknown[];
  };
  expect(liquidationBody.monitor.status).toBe('not_connected');
  expect(liquidationBody.borrowers).toEqual([]);
  expect(liquidationBody.liquidations).toEqual([]);

  const other = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'other@atom.local',
      password: fixturePassword,
      name: 'Other',
      workspaceName: 'Empty desk',
    }),
  });
  const otherCookie = cookieHeader(other);
  const otherDash = await app.request('/api/dashboard', { headers: { cookie: otherCookie } });
  const otherBody = (await otherDash.json()) as { kpis: { allTimeTrades: number } };
  expect(otherBody.kpis.allTimeTrades).toBe(0);

  const paused = await app.request('/api/safety', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ ingestionPaused: true, signingEnabled: true }),
  });
  expect(paused.status).toBe(200);
  const safety = (await paused.json()) as { signingEnabled: boolean; paperOnlyLocked: boolean; ingestionPaused: boolean };
  expect(safety.paperOnlyLocked).toBe(true);
  expect(safety.signingEnabled).toBe(false);
  expect(safety.ingestionPaused).toBe(true);

  const blocked = await app.request('/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${created.ingestionKey}` },
    body: JSON.stringify({ source: 'sample-logs', batches: [] }),
  });
  expect(blocked.status).toBe(423);

  const anon = await app.request('/api/dashboard');
  expect(anon.status).toBe(401);

  const checkout = await app.request('/api/billing/checkout', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ planId: 'desk' }),
  });
  expect(checkout.status).toBe(501);
  const checkoutBody = (await checkout.json()) as { code: string };
  expect(checkoutBody.code).toBe('stripe_not_configured');

  expect(roundTripCostSol(config.costs)).toBeCloseTo(0.000205, 12);
});

function cookieHeader(response: Response): string {
  const cookies = response.headers.getSetCookie?.() ?? [];
  const pair = cookies.map((cookie) => cookie.split(';')[0]).find((cookie) => cookie.startsWith('atom_session='));
  if (!pair) throw new Error('missing session cookie');
  return pair;
}
