import { Link } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import { Caveat, PageHeader, StateMessage } from '../components/ui';
import { formatPhoenix } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { BotsPayload } from '../types';

export function BotsPage() {
  const { data, error, loading } = useApi<BotsPayload>('/api/bots');
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader icon={Terminal} title="LIVE BOTS" subtitle="Read-only quote scanners derived from ingestion" />
      {data ? <Caveat text={data.caveat} /> : null}
      {loading && !data ? <StateMessage title="Loading scanners" body="Checking stored heartbeats and quote timestamps." /> : null}
      {error ? <StateMessage title="Scanners unavailable" body={error} /> : null}
      <div className="grid gap-4">
        {data?.scanners.map((scanner) => (
          <article key={scanner.name} className="tech-border bg-atom-card p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${scanner.status === 'ONLINE' ? 'bg-atom-success' : 'bg-atom-warning'}`} />
              <h3 className="font-mono text-lg font-bold uppercase text-white">{scanner.name}</h3>
              <span className="border border-atom-border px-2 py-0.5 font-mono text-[10px] uppercase text-atom-muted">{scanner.role}</span>
              <span className="font-mono text-[10px] uppercase text-atom-accent">{scanner.status}</span>
            </div>
            <dl className="mt-6 grid gap-4 font-mono text-[11px] sm:grid-cols-3">
              <Field label="Last quote" value={scanner.lastEventAt ? formatPhoenix(scanner.lastEventAt) : '—'} />
              <Field label="Last heartbeat" value={scanner.lastHeartbeatAt ? formatPhoenix(scanner.lastHeartbeatAt) : 'none'} />
              <Field label="Cycles observed" value={scanner.cyclesObserved === null ? '—' : String(scanner.cyclesObserved)} />
              <Field label="Quotes stored" value={String(scanner.quoteCount)} />
              <Field label="Paper trades" value={String(scanner.paperTrades)} />
              <Field label="Region" value="not reported" />
            </dl>
            <p className="mt-4 font-mono text-[11px] leading-relaxed text-atom-muted">{scanner.note}</p>
            <Link to="/app/live" className="mt-4 inline-block font-mono text-[10px] uppercase tracking-widest text-atom-accent">
              View ingestion log
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="uppercase text-atom-muted">{label}</div>
      <div className="mt-1 text-white">{value}</div>
    </div>
  );
}
