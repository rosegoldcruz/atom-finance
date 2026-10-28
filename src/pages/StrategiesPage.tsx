import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Server } from 'lucide-react';
import { Caveat, PageHeader, StateMessage } from '../components/ui';
import { formatUsd } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { StrategiesPayload } from '../types';

export function StrategiesPage() {
  const { data, error, loading } = useApi<StrategiesPayload>('/api/strategies');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data?.strategies.find((strategy) => strategy.id === selectedId) ?? null;

  if (selected && data) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-2 font-mono text-[11px] uppercase text-atom-muted">
          <ArrowLeft size={16} /> All strategies
        </button>
        <h2 className="text-2xl font-bold uppercase text-white">{selected.name}</h2>
        <Caveat text={data.caveat} />
        <p className="max-w-3xl font-mono text-sm leading-relaxed text-atom-muted">{selected.description}</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Quotes" value={metric(selected.metrics.quoted)} />
          <Metric label="Net-positive quotes" value={metric(selected.metrics.netPositive)} />
          <Metric label="Paper trades" value={metric(selected.metrics.paperTrades)} />
          <Metric label="Avg paper net USD" value={selected.metrics.avgPaperNetUsd === null ? '—' : formatUsd(selected.metrics.avgPaperNetUsd)} />
          <Metric label="10× fee clears" value={metric(selected.metrics.tenXTrades)} />
          <Metric label="Status" value={selected.status} />
        </div>
        <section className="tech-border bg-atom-card p-5">
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-white">Guardrails</h3>
          <pre className="mt-3 overflow-x-auto font-mono text-[11px] text-atom-muted">{JSON.stringify(selected.guardrails, null, 2)}</pre>
          <p className="mt-3 font-mono text-[11px] text-atom-muted">These values are descriptive. This desk cannot deploy or sign a strategy.</p>
        </section>
        {selected.id === 'aave-v3-watch' ? (
          <Link to="/app/liquidations" className="font-mono text-[11px] uppercase text-atom-accent">
            Open liquidation scaffold
          </Link>
        ) : null}
        {selected.id === 'single-dex' && data.venuesObserved.length > 0 ? (
          <p className="font-mono text-[11px] text-atom-muted">Venues observed in stored quotes: {data.venuesObserved.join(', ')}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader icon={Server} title="STRATEGIES" subtitle="Measurements from stored quotes, not live orders" />
      {data ? <Caveat text={data.caveat} /> : null}
      {loading && !data ? <StateMessage title="Loading strategies" body="Counting stored quotes and paper trades." /> : null}
      {error ? <StateMessage title="Strategies unavailable" body={error} /> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {data?.strategies.map((strategy) => (
          <button key={strategy.id} onClick={() => setSelectedId(strategy.id)} className="tech-border bg-atom-card p-5 text-left">
            <div className="font-mono text-[10px] uppercase text-atom-accent">{strategy.status}</div>
            <h3 className="mt-3 text-lg font-bold uppercase text-white">{strategy.name}</h3>
            <p className="mt-2 line-clamp-4 font-mono text-[11px] leading-relaxed text-atom-muted">{strategy.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="border border-atom-border p-2">
                <div className="text-atom-muted">Net-positive</div>
                <div className="text-white">{metric(strategy.metrics.netPositive)}</div>
              </div>
              <div className="border border-atom-border p-2">
                <div className="text-atom-muted">Paper trades</div>
                <div className="text-white">{metric(strategy.metrics.paperTrades)}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-atom-border bg-atom-card p-4">
      <div className="font-mono text-[10px] uppercase text-atom-muted">{label}</div>
      <div className="mt-1 font-mono text-xl text-white">{value}</div>
    </div>
  );
}

function metric(value: number | null): string {
  return value === null ? '—' : String(value);
}
