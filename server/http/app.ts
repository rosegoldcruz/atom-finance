import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient, User, Workspace } from '@prisma/client';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { hashPassword, hashToken, newIngestionKey, newSessionToken, verifyPassword } from '../auth/crypto';
import { PLANS, planById, stripeConfigured } from '../billing/plans';
import { CAVEAT } from '../domain/paper';
import { applyIngest } from '../ingest';
import { activityFeed, bots, dashboard, liquidations, listTrades, strategies, tradesToCsv } from '../queries';

const SESSION_COOKIE = 'atom_session';
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packageVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version as string;

type Vars = { user: User | null; workspace: Workspace | null };

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(80),
  workspaceName: z.string().trim().min(1).max(80),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const SettingsBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  workspaceName: z.string().trim().min(1).max(80).optional(),
  crtOverlay: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
});

const IngestBody = z.object({
  source: z.string().trim().min(1).max(120).optional(),
  batches: z
    .array(
      z.object({
        kind: z.string().min(1).max(64),
        rows: z.array(z.record(z.string(), z.unknown())).optional(),
        scanner: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(20),
});

export function createApp(prisma: PrismaClient) {
  const app = new Hono<{ Variables: Vars }>();

  app.use('*', async (c, next) => {
    c.set('user', null);
    c.set('workspace', null);
    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: { include: { memberships: { include: { workspace: true }, take: 1 } } } },
      });
      if (session && session.expiresAt.getTime() > Date.now()) {
        c.set('user', session.user);
        c.set('workspace', session.user.memberships[0]?.workspace ?? null);
      }
    }
    await next();
  });

  app.get('/api/health', (c) => c.json({ ok: true, mode: 'paper', service: 'atom-api' }));

  app.get('/api/plans', (c) =>
    c.json({
      plans: PLANS.map((plan) => ({
        ...plan,
        checkoutReady: stripeConfigured(plan),
      })),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    }),
  );

  app.post('/api/auth/register', async (c) => {
    const parsed = RegisterBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const email = parsed.data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return c.json({ error: 'email_taken' }, 409);
    const passwordHash = await hashPassword(parsed.data.password);
    const ingestionKey = newIngestionKey();
    const created = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash,
        memberships: {
          create: {
            role: 'owner',
            workspace: { create: { name: parsed.data.workspaceName } },
          },
        },
      },
      include: { memberships: { include: { workspace: true } } },
    });
    const workspace = created.memberships[0].workspace;
    await prisma.ingestionKey.create({
      data: {
        workspaceId: workspace.id,
        name: 'scanner',
        prefix: ingestionKey.slice(0, 12),
        keyHash: hashToken(ingestionKey),
      },
    });
    await startSession(c, prisma, created.id);
    return c.json(
      {
        user: publicUser(created),
        workspace: { id: workspace.id, name: workspace.name, plan: workspace.plan },
        ingestionKey,
      },
      201,
    );
  });

  app.post('/api/auth/login', async (c) => {
    const parsed = LoginBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return c.json({ error: 'invalid_login' }, 401);
    }
    await startSession(c, prisma, user.id);
    return c.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  app.get('/api/session', (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    return c.json({
      user: publicUser(auth.user),
      workspace: publicWorkspace(auth.workspace),
      caveat: CAVEAT,
    });
  });

  app.post('/api/ingest', async (c) => {
    const raw = bearer(c.req.header('authorization')) || c.req.header('x-atom-ingestion-key');
    if (!raw) return c.json({ error: 'missing_ingestion_key' }, 401);
    const key = await prisma.ingestionKey.findUnique({
      where: { keyHash: hashToken(raw) },
      include: { workspace: true },
    });
    if (!key || key.revokedAt) return c.json({ error: 'invalid_ingestion_key' }, 401);
    if (key.workspace.ingestionPaused) return c.json({ error: 'ingestion_paused' }, 423);
    const parsed = IngestBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    try {
      const result = await applyIngest(prisma, key.workspace, parsed.data);
      return c.json(result);
    } catch (error) {
      console.error('ingest failed', error instanceof Error ? error.message : 'unknown');
      return c.json({ error: 'ingest_failed' }, 500);
    }
  });

  app.get('/api/dashboard', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    const day = c.req.query('day');
    if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return c.json({ error: 'invalid_day' }, 400);
    return c.json(await dashboard(prisma, auth.workspace.id, day));
  });

  app.get('/api/trades.csv', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    const filters = tradeFilters(c.req.query());
    if ('error' in filters) return c.json(filters, 400);
    const data = await listTrades(prisma, auth.workspace.id, filters);
    return c.body(tradesToCsv(data.trades), 200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="atom-paper-trades.csv"',
    });
  });

  app.get('/api/trades', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    const filters = tradeFilters(c.req.query());
    if ('error' in filters) return c.json(filters, 400);
    return c.json(await listTrades(prisma, auth.workspace.id, filters));
  });

  app.get('/api/activity', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    return c.json(await activityFeed(prisma, auth.workspace.id));
  });

  app.get('/api/strategies', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    return c.json(await strategies(prisma, auth.workspace.id, auth.workspace.roundTripCostSol, auth.workspace.tenXMultiple));
  });

  app.get('/api/bots', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    return c.json(await bots(prisma, auth.workspace.id));
  });

  app.get('/api/liquidations', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    return c.json(await liquidations(prisma, auth.workspace.id));
  });

  app.get('/api/safety', (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    return c.json(safetyView(auth.workspace));
  });

  app.patch('/api/safety', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    const body = (await c.req.json().catch(() => ({}))) as { ingestionPaused?: unknown };
    const ingestionPaused = typeof body.ingestionPaused === 'boolean' ? body.ingestionPaused : auth.workspace.ingestionPaused;
    const updated = await prisma.workspace.update({
      where: { id: auth.workspace.id },
      data: { ingestionPaused },
    });
    return c.json(safetyView(updated));
  });

  app.get('/api/settings', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    const keys = await prisma.ingestionKey.findMany({
      where: { workspaceId: auth.workspace.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return c.json({
      user: publicUser(auth.user),
      workspace: publicWorkspace(auth.workspace),
      ingestionKeys: keys.map((key) => ({ id: key.id, name: key.name, prefix: key.prefix, createdAt: key.createdAt.toISOString() })),
      build: { version: packageVersion, mode: 'paper' },
    });
  });

  app.patch('/api/settings', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    const parsed = SettingsBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    if (parsed.data.name) {
      await prisma.user.update({ where: { id: auth.user.id }, data: { name: parsed.data.name } });
    }
    const workspace = await prisma.workspace.update({
      where: { id: auth.workspace.id },
      data: {
        name: parsed.data.workspaceName,
        crtOverlay: parsed.data.crtOverlay,
        soundEnabled: parsed.data.soundEnabled,
      },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    return c.json({ user: publicUser(user), workspace: publicWorkspace(workspace) });
  });

  app.post('/api/settings/ingestion-keys', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    const body = (await c.req.json().catch(() => ({}))) as { name?: unknown };
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 40) : 'scanner';
    const token = newIngestionKey();
    const key = await prisma.ingestionKey.create({
      data: { workspaceId: auth.workspace.id, name, prefix: token.slice(0, 12), keyHash: hashToken(token) },
    });
    return c.json({ id: key.id, name: key.name, prefix: key.prefix, ingestionKey: token }, 201);
  });

  app.delete('/api/settings/ingestion-keys/:id', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    const key = await prisma.ingestionKey.findFirst({ where: { id: c.req.param('id'), workspaceId: auth.workspace.id } });
    if (!key) return c.json({ error: 'not_found' }, 404);
    await prisma.ingestionKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
    return c.json({ ok: true });
  });

  app.post('/api/billing/checkout', async (c) => {
    const auth = requireAuth(c);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);
    const body = (await c.req.json().catch(() => null)) as { planId?: string } | null;
    const plan = body?.planId ? planById(body.planId) : undefined;
    if (!plan || plan.priceMonthlyUsd === 0 || !plan.stripePriceEnv) {
      return c.json({ code: 'not_purchasable', message: 'That plan has no Stripe price.' }, 400);
    }
    const price = process.env[plan.stripePriceEnv];
    if (!process.env.STRIPE_SECRET_KEY || !price) {
      return c.json(
        {
          code: 'stripe_not_configured',
          message: 'Stripe is not configured. Set STRIPE_SECRET_KEY and the plan price id on the server. No charge was created.',
          checkoutReady: false,
        },
        501,
      );
    }
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin = process.env.APP_ORIGIN || 'http://localhost:8080';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/app/settings?billing=success`,
      cancel_url: `${origin}/pricing?billing=cancel`,
      client_reference_id: auth.workspace.id,
      metadata: { workspaceId: auth.workspace.id, plan: plan.id },
    });
    return c.json({ url: session.url, checkoutReady: true });
  });

  app.post('/api/billing/webhook', async (c) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return c.json({ code: 'stripe_not_configured' }, 501);
    }
    const signature = c.req.header('stripe-signature');
    if (!signature) return c.json({ error: 'missing_signature' }, 400);
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(await c.req.text(), signature, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const workspaceId = session.metadata?.workspaceId || session.client_reference_id;
      const plan = session.metadata?.plan;
      if (workspaceId && (plan === 'desk' || plan === 'institution')) {
        await prisma.workspace.update({ where: { id: workspaceId }, data: { plan } });
      }
    }
    return c.json({ received: true });
  });

  return app;
}

function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name };
}

function publicWorkspace(workspace: Workspace) {
  return {
    id: workspace.id,
    name: workspace.name,
    plan: workspace.plan,
    timezone: workspace.timezone,
    crtOverlay: workspace.crtOverlay,
    soundEnabled: workspace.soundEnabled,
    ingestionPaused: workspace.ingestionPaused,
    roundTripCostSol: workspace.roundTripCostSol,
    tenXMultiple: workspace.tenXMultiple,
  };
}

function safetyView(workspace: Workspace) {
  return {
    paperOnlyLocked: true,
    signingEnabled: false,
    walletConnected: false,
    privateKeysStored: false,
    ingestionPaused: workspace.ingestionPaused,
    tenXMultiple: workspace.tenXMultiple,
    roundTripCostSol: workspace.roundTripCostSol,
    tenXGrossSol: workspace.roundTripCostSol * workspace.tenXMultiple,
    timezone: 'America/Phoenix',
    caveat: CAVEAT,
  };
}

function requireAuth(c: Context<{ Variables: Vars }>): { user: User; workspace: Workspace } | null {
  const user = c.get('user');
  const workspace = c.get('workspace');
  if (!user || !workspace) return null;
  return { user, workspace };
}

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function startSession(c: Context<{ Variables: Vars }>, prisma: PrismaClient, userId: string) {
  const token = newSessionToken();
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_MS) },
  });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_MS / 1000,
  });
}

function tradeFilters(query: Record<string, string | undefined>): { day?: string; pair?: string; route?: string; tenx?: boolean; limit: number } | { error: string } {
  if (query.day && !/^\d{4}-\d{2}-\d{2}$/.test(query.day)) return { error: 'invalid_day' };
  const limit = query.limit ? Number(query.limit) : 200;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return { error: 'invalid_limit' };
  return {
    day: query.day,
    pair: query.pair,
    route: query.route,
    tenx: query.tenx === '1' || query.tenx === 'true',
    limit,
  };
}
