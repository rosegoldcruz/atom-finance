import { ShieldAlert } from 'lucide-react';
import { Caveat, PageHeader, StateMessage } from '../components/ui';
import { formatPhoenix, formatUsd } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { LiquidationsPayload } from '../types';

export function LiquidationsPage() {
  const { data, error, loading } = useApi<LiquidationsPayload>('/api/liquidations');
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader icon={ShieldAlert} title="LIQUIDATIONS" subtitle="Aave V3 read-only scaffold · Arbitrum, Base, Optimism, Polygon" />
      {data ? <Caveat text={data.caveat} /> : null}
      {loading && !data ? <StateMessage title="Loading monitor" body="Checking stored borrower and liquidation reports." /> : null}
      {error ? <StateMessage title="Monitor unavailable" body={error} /> : null}
      {data ? (
        <>
          <section className="tech-border bg-atom-card p-5 font-mono text-[11px]">
            <div className="text-atom-accent uppercase">{data.monitor.status.replaceAll('_', ' ')}</div>
            <p className="mt-2 text-atom-muted">
              Protocol {data.monitor.protocol} · mode {data.monitor.mode} · chains {data.monitor.chains.join(', ')}.
              This page shows rows only after a read-only monitor posts them. It does not query chains itself and it does not liquidate.
            </p>
          </section>
          <section>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-white">Borrower health factors</h3>
            {data.borrowers.length === 0 ? (
              <StateMessage title="No borrower snapshots" body="Post kind aave_borrowers when the monitor exists. Empty means no reports, not a healthy market." />
            ) : (
              <Table
                headers={['Chain', 'Borrower', 'Health factor', 'Collateral USD', 'Debt USD', 'Observed']}
                rows={data.borrowers.map((row) => [
                  row.chain,
                  row.borrower,
                  row.healthFactor.toFixed(4),
                  row.collateralUsd === null ? '—' : formatUsd(row.collateralUsd),
                  row.debtUsd === null ? '—' : formatUsd(row.debtUsd),
                  formatPhoenix(row.observedAt),
                ])}
              />
            )}
          </section>
          <section>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-white">Liquidations observed</h3>
            {data.liquidations.length === 0 ? (
              <StateMessage title="No liquidations observed" body="Bonus captured and gas paid stay blank until a monitor reports a real transaction. Winners are other searchers, not this desk." />
            ) : (
              <Table
                headers={['Chain', 'Tx', 'Borrower', 'Bonus captured by winner', 'Gas paid', 'Observed']}
                rows={data.liquidations.map((row) => [
                  row.chain,
                  row.txHash,
                  row.borrower,
                  row.bonusCapturedUsd === null ? '—' : formatUsd(row.bonusCapturedUsd),
                  row.gasPaidNative === null ? '—' : String(row.gasPaidNative),
                  formatPhoenix(row.observedAt),
                ])}
              />
            )}
          </section>
          <section className="font-mono text-[10px] text-atom-muted">
            <div>Borrower fields: {data.schema.borrowers.join(', ')}</div>
            <div className="mt-1">Liquidation fields: {data.schema.liquidations.join(', ')}</div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto border border-atom-border">
      <table className="min-w-full font-mono text-[11px]">
        <thead className="bg-atom-card text-left text-atom-muted">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-normal uppercase">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-atom-border">
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="max-w-xs truncate px-3 py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
