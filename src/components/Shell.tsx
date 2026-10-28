import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, Clock, Lock, Radio, ReceiptText, Server, Settings, Shield, ShieldAlert, Terminal } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { BotsPayload } from '../types';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: Activity, end: true },
  { to: '/app/live', label: 'Live Activity', icon: Radio },
  { to: '/app/bots', label: 'Live Bots', icon: Terminal },
  { to: '/app/strategies', label: 'Strategies', icon: Server },
  { to: '/app/profit', label: 'Profit Log', icon: ReceiptText },
  { to: '/app/liquidations', label: 'Liquidations', icon: ShieldAlert },
  { to: '/app/safety', label: 'Safety', icon: Shield },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const MOBILE = [
  { to: '/app', label: 'Dashboard', icon: Activity, end: true },
  { to: '/app/bots', label: 'Live Bots', icon: Terminal },
  { to: '/app/strategies', label: 'Strategies', icon: Server },
  { to: '/app/profit', label: 'Profit', icon: ReceiptText },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export function Shell() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const [scanner, setScanner] = useState<string>('…');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancel = false;
    api<BotsPayload>('/api/bots')
      .then((body) => {
        if (!cancel) setScanner(body.scanners[0]?.status ?? 'OFFLINE');
      })
      .catch(() => {
        if (!cancel) setScanner('UNKNOWN');
      });
    return () => {
      cancel = true;
    };
  }, []);

  const initials = (session?.user.name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="flex h-dvh flex-col bg-atom-bg text-atom-text">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-atom-border bg-atom-card px-4 font-mono text-[11px] lg:px-6">
        <div className="flex items-center gap-4">
          <span className="font-bold uppercase tracking-widest text-atom-accent">Paper / read-only</span>
          <span className="hidden text-atom-muted sm:inline">Scanner {scanner}</span>
        </div>
        <div className="flex items-center gap-4 text-atom-muted">
          <span className="flex items-center gap-2">
            <Clock size={14} /> {now.toLocaleTimeString()}
          </span>
          <span className="hidden items-center gap-2 sm:flex">
            <Lock size={14} /> No keys stored
          </span>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-atom-border bg-atom-bg lg:flex">
          <div className="border-b border-atom-border p-8">
            <button onClick={() => navigate('/')} className="flex items-center gap-3 text-2xl font-bold tracking-tighter text-white">
              <span className="h-4 w-4 rotate-45 bg-atom-accent" /> ATOM
            </button>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-atom-muted">Paper desk</p>
          </div>
          <nav className="flex-1 py-4">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 px-8 py-3 font-mono text-[11px] font-bold uppercase tracking-widest ${
                    isActive ? 'bg-atom-accent/5 text-atom-accent' : 'text-atom-muted hover:bg-atom-card hover:text-white'
                  }`
                }
              >
                <item.icon size={16} /> {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-atom-border p-6">
            <div className="mb-3 font-mono text-[9px] uppercase text-atom-muted">{session?.workspace.name}</div>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center bg-atom-border font-mono text-xs text-white">{initials}</div>
              <div>
                <div className="font-mono text-[10px] font-bold uppercase text-white">{session?.user.name}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-atom-success">{session?.workspace.plan}</div>
              </div>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto pb-28 lg:pb-0">
          <Outlet />
        </main>
      </div>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-atom-border bg-atom-bg/95 px-2 pt-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {MOBILE.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center rounded-xl font-mono text-[10px] ${isActive ? 'text-atom-accent' : 'text-atom-muted'}`
              }
            >
              <item.icon size={16} />
              <span className="mt-1">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
