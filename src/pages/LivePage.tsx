import { useEffect, useState } from 'react';
import { Radio, X } from 'lucide-react';
import { Caveat, PageHeader, StateMessage } from '../components/ui';
import { formatPhoenix } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { ActivityPayload } from '../types';

export function LivePage() {
  const { data, error, loading, reload } = useApi<ActivityPayload>('/api/activity');
  const [selected, setSelected] = useState<ActivityPayload['items'][number] | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => reload(), 15000);
    return () => window.clearInterval(timer);
  }, [reload]);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader icon={Radio} title="LIVE ACTIVITY" subtitle="Latest stored paper trades and ingestion receipts">
        <button onClick={() => reload()} className="border border-atom-border px-3 py-2 font-mono text-[10px] uppercase text-atom-muted">
          Refresh
        </button>
      </PageHeader>
      {data ? <Caveat text={data.caveat} /> : null}
      {loading && !data ? <StateMessage title="Loading activity" body="Reading the stored feed." /> : null}
      {error ? <StateMessage title="Activity unavailable" body={error} /> : null}
      {data && data.items.length === 0 ? (
        <StateMessage title="No paper events yet" body="Post a paper ledger to the ingestion endpoint. This feed does not invent executions." />
      ) : null}
      <div className="grid gap-3">
        {data?.items.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="tech-border bg-atom-card p-4 text-left"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase text-atom-muted">
              <span>{formatPhoenix(item.timestamp)}</span>
              <span className={item.tenXFees ? 'text-atom-warning' : 'text-atom-accent'}>
                {item.severity}
                {item.tenXFees ? ' · 10× fees' : ''}
              </span>
            </div>
            <div className="mt-2 font-mono text-sm text-white">{item.title}</div>
            <div className="mt-1 font-mono text-[11px] text-atom-muted">{item.summary}</div>
          </button>
        ))}
      </div>
      {selected ? (
        <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-atom-border bg-atom-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-atom-border p-4">
            <h3 className="font-mono text-xs uppercase tracking-widest text-white">Stored payload</h3>
            <button onClick={() => setSelected(null)} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3 overflow-y-auto p-4 font-mono text-[11px]">
            <p className="text-atom-muted">No on-chain hash. This row was quoted, not submitted.</p>
            <pre className="overflow-x-auto whitespace-pre-wrap border border-atom-border bg-black p-3 text-atom-muted">
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
