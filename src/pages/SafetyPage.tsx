import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Caveat, PageHeader, StateMessage } from '../components/ui';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { SafetyPayload } from '../types';

export function SafetyPage() {
  const { data, error, loading, reload } = useApi<SafetyPayload>('/api/safety');
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function togglePause() {
    if (!data) return;
    setPending(true);
    setSaveError(null);
    try {
      await api('/api/safety', {
        method: 'PATCH',
        body: JSON.stringify({ ingestionPaused: !data.ingestionPaused }),
      });
      reload();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'save_failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader icon={Shield} title="SAFETY" subtitle="Paper lock is permanent in this build" />
      {data ? <Caveat text={data.caveat} /> : null}
      {loading && !data ? <StateMessage title="Loading safety" body="Reading workspace locks." /> : null}
      {error ? <StateMessage title="Safety unavailable" body={error} /> : null}
      {data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="tech-border bg-atom-card p-6 space-y-3">
            <Lock label="Paper-only mode" value="ON" detail="Quotes and stored rows only." />
            <Lock label="Transaction signing" value="OFF" detail="No wallet connection and no send path." />
            <Lock label="Keys stored on this desk" value="NONE" />
            <Lock label="10× fee tag" value={`${data.tenXGrossSol.toFixed(6)} SOL gross`} detail={`${data.tenXMultiple}× a ${data.roundTripCostSol} SOL round trip.`} />
          </section>
          <section className="tech-border bg-atom-card p-6">
            <h3 className="font-mono text-xs uppercase tracking-widest text-white">Ingestion pause</h3>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-atom-muted">
              Pausing rejects new scanner posts with HTTP 423. It does not move capital, because this desk holds none.
            </p>
            <button
              onClick={() => void togglePause()}
              disabled={pending}
              className="mt-6 w-full border border-atom-warning px-4 py-4 font-mono text-sm uppercase text-atom-warning"
            >
              {data.ingestionPaused ? 'Resume ingestion' : 'Pause ingestion'}
            </button>
            {saveError ? <p className="mt-3 font-mono text-[11px] text-atom-error">{saveError}</p> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Lock({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border border-atom-border bg-atom-bg p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="font-mono text-sm uppercase text-white">{label}</div>
        <div className="font-mono text-xs text-atom-success">{value}</div>
      </div>
      {detail ? <p className="mt-2 font-mono text-[11px] text-atom-muted">{detail}</p> : null}
    </div>
  );
}
