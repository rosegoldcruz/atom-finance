import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useApi } from '../lib/useApi';
import type { PlansPayload } from '../types';

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-atom-bg text-atom-text">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3 text-xl font-bold tracking-tighter">
          <span className="h-3 w-3 rotate-45 bg-atom-accent" /> ATOM
        </div>
        <nav className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-widest text-atom-muted">
          <Link to="/pricing">Pricing</Link>
          <Link to="/login">Log in</Link>
          <Link to="/register" className="border border-atom-accent px-3 py-2 text-atom-accent">Open a desk</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-atom-accent">Arbitrage Trustless On-chain Module</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
          A paper desk for quote gaps. No wallet. No sends.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">
          ATOM ingests the read-only Solana scanner’s paper ledger and shows hypothetical P&amp;L by Phoenix day, pair, and route.
          Numbers are quote-based upper bounds. The Aave V3 liquidation view is scaffolded and stays empty until a monitor posts real observations.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/register" className="bg-atom-accent px-5 py-3 font-mono text-sm font-bold uppercase text-black">Create workspace</Link>
          <Link to="/pricing" className="border border-atom-border px-5 py-3 font-mono text-sm uppercase text-white">See plans</Link>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <Feature title="Paper ledger" body="Per-day hypothetical net SOL and USD, the 10× fee flag, and the route that produced the quote." />
          <Feature title="Scanner contract" body="Your scanner POSTs CSV-shaped JSON. Replays are idempotent. Pause stops intake without touching a wallet." />
          <Feature title="Liquidation shelf" body="Schema for Aave V3 health factors on Arbitrum, Base, Optimism, and Polygon. No invented borrowers." />
        </div>
      </main>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <article className="tech-border bg-atom-card p-5">
      <h2 className="font-mono text-sm uppercase text-white">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-atom-muted">{body}</p>
    </article>
  );
}

export function PricingPage() {
  const { data, error, loading } = useApi<PlansPayload>('/api/plans');
  const { session } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);

  async function checkout(planId: string) {
    setNotice(null);
    try {
      const result = await api<{ url?: string; message?: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      if (result.url) window.location.href = result.url;
    } catch (reason) {
      const body = reason && typeof reason === 'object' && 'body' in reason ? (reason as { body?: { message?: string } }).body : undefined;
      setNotice(body?.message || 'Checkout is not configured.');
    }
  }

  return (
    <div className="min-h-dvh bg-atom-bg px-6 py-10 text-atom-text">
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="font-mono text-[11px] uppercase text-atom-muted">ATOM</Link>
        <h1 className="mt-6 text-4xl font-black text-white">Plans</h1>
        <p className="mt-3 max-w-2xl text-sm text-atom-muted">
          Prices are placeholders. Stripe Checkout is called only when STRIPE_SECRET_KEY and a price id are set on the server. This build does not hide the paper desk behind a paid plan.
        </p>
        {loading ? <p className="mt-8 font-mono text-xs text-atom-muted">Loading plans…</p> : null}
        {error ? <p className="mt-8 font-mono text-xs text-atom-error">{error}</p> : null}
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {data?.plans.map((plan) => (
            <article key={plan.id} className="tech-border bg-atom-card p-6">
              <h2 className="font-mono text-lg uppercase text-white">{plan.name}</h2>
              <div className="mt-3 font-mono text-3xl text-atom-accent">
                {plan.priceMonthlyUsd === 0 ? '$0' : `$${plan.priceMonthlyUsd}`}<span className="text-sm text-atom-muted">/mo</span>
              </div>
              <p className="mt-3 text-sm text-atom-muted">{plan.summary}</p>
              <ul className="mt-4 space-y-2 font-mono text-[11px] text-zinc-300">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {plan.priceMonthlyUsd === 0 ? (
                <Link to={session ? '/app' : '/register'} className="mt-6 inline-block font-mono text-[11px] uppercase text-atom-accent">
                  {session ? 'Open desk' : 'Create workspace'}
                </Link>
              ) : (
                <button
                  onClick={() => void checkout(plan.id)}
                  disabled={!session}
                  className="mt-6 border border-atom-border px-3 py-2 font-mono text-[11px] uppercase text-white disabled:text-atom-muted"
                >
                  {plan.checkoutReady ? 'Continue to Stripe' : 'Stripe not configured'}
                </button>
              )}
            </article>
          ))}
        </div>
        {notice ? <p className="mt-6 font-mono text-[11px] text-atom-warning">{notice}</p> : null}
        {!session && data ? <p className="mt-4 font-mono text-[11px] text-atom-muted">Log in before starting checkout.</p> : null}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { session, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) return <Navigate to="/app" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      await refresh();
      navigate('/app');
    } catch {
      setError('Those credentials were not accepted.');
    }
  }

  return (
    <AuthFrame title="Log in" footer={<Link to="/register">Create a workspace</Link>}>
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
        <Field name="email" type="email" label="Email" />
        <Field name="password" type="password" label="Password" />
        {error ? <p className="font-mono text-[11px] text-atom-error">{error}</p> : null}
        <button className="w-full bg-atom-accent py-3 font-mono text-sm font-bold uppercase text-black">Enter desk</button>
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { session, loading, refresh } = useAuth();
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!loading && session && !key) return <Navigate to="/app" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const created = await api<{ ingestionKey: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          name: form.get('name'),
          workspaceName: form.get('workspaceName'),
        }),
      });
      setKey(created.ingestionKey);
      await refresh();
    } catch {
      setError('Could not create that workspace. The email may already be registered.');
    }
  }

  return (
    <AuthFrame title="Open a desk" footer={<Link to="/login">Already have a desk</Link>}>
      {key ? (
        <div className="space-y-4 font-mono text-[12px]">
          <p className="text-atom-warning">Copy the ingestion key. It is shown once.</p>
          <p className="break-all border border-atom-border p-3 text-white">{key}</p>
          <Link to="/app" className="inline-block bg-atom-accent px-4 py-3 font-bold uppercase text-black">Go to dashboard</Link>
        </div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <Field name="name" label="Your name" />
          <Field name="workspaceName" label="Workspace" />
          <Field name="email" type="email" label="Email" />
          <Field name="password" type="password" label="Password" />
          {error ? <p className="font-mono text-[11px] text-atom-error">{error}</p> : null}
          <button className="w-full bg-atom-accent py-3 font-mono text-sm font-bold uppercase text-black">Create</button>
        </form>
      )}
    </AuthFrame>
  );
}

function AuthFrame({ title, footer, children }: { title: string; footer: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-atom-bg px-4">
      <div className="tech-border w-full max-w-md bg-atom-card p-8">
        <Link to="/" className="font-mono text-[11px] uppercase tracking-widest text-atom-muted">ATOM</Link>
        <h1 className="mt-4 text-2xl font-bold text-white">{title}</h1>
        <div className="mt-6">{children}</div>
        <div className="mt-6 font-mono text-[11px] uppercase text-atom-accent">{footer}</div>
      </div>
    </div>
  );
}

function Field({ name, label, type = 'text' }: { name: string; label: string; type?: string }) {
  return (
    <label className="block font-mono text-[10px] uppercase text-atom-muted">
      {label}
      <input name={name} type={type} required className="mt-2 w-full border border-atom-border bg-atom-bg p-3 text-sm text-white outline-none" />
    </label>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-8 font-mono text-xs text-atom-muted">Checking session…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}
