import { Link, useSearchParams } from 'react-router-dom';
import { Activity, Target, TrendingUp, Zap } from 'lucide-react';
import { Caveat, PageHeader, Panel, Sparkline, StateMessage, StatCard } from '../components/ui';
import { formatBps, formatSignedUsd, formatSol } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { DashboardPayload } from '../types';

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const day = params.get('day');
  const query = day ? `/api/dashboard?day=${day}` : '/api/dashboard';
  const { data, error, loading } = useApi<DashboardPayload>(query);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader icon={Activity} title="DASHBOARD" subtitle="Hypothetical P&L from stored paper trades · America/Phoenix">
        <div className="font-mono text-[10px] uppercase text-atom-muted">Quotes only · no fills</div>
      </PageHeader>
      {loading && !data ? <StateMessage title="Loading ledger" body="Reading stored paper trades." /> : null}
      {error ? <StateMessage title="Dashboard unavailable" body={error} /> : null}
      {data ? (
        <>
          <Caveat text={data.caveat} />
          <div className="glass rounded-3xl p-4 lg:hidden">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-atom-muted">{data.selectedDay} hypothetical</div>
            <div className="mt-1 font-mono text-4xl font-black text-white">{formatSignedUsd(data.kpis.dayNetUsd)}</div>
            <div className="mt-3">
              <Sparkline points={data.intraday.map((point) => point.cumulativeUsd)} />
            </div>
            <Link to="/app/profit" className="mt-3 block text-center font-mono text-[11px] uppercase tracking-widest text-atom-accent">
              Open paper ledger
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.availableDays.map((item) => (
              <button
                key={item}
                onClick={() => setParams(item === data.availableDays.at(-1) && !day ? {} : { day: item })}
                className={`border px-3 py-1 font-mono text-[10px] uppercase ${item === data.selectedDay ? 'border-atom-accent text-atom-accent' : 'border-atom-border text-atom-muted'}`}
              >
                {item}
                {item === data.today ? ' · today' : ''}
              </button>
            ))}
            {!data.availableDays.includes(data.today) ? (
              <button
                onClick={() => setParams({ day: data.today })}
                className={`border px-3 py-1 font-mono text-[10px] uppercase ${data.selectedDay === data.today ? 'border-atom-accent text-atom-accent' : 'border-atom-border text-atom-muted'}`}
              >
                {data.today} · today
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={`${data.selectedDay} net USD`} value={formatSignedUsd(data.kpis.dayNetUsd)} detail="hypothetical" icon={TrendingUp} />
            <StatCard label={`${data.selectedDay} net SOL`} value={formatSol(data.kpis.dayNetSol)} icon={Zap} />
            <StatCard label="Paper trades" value={String(data.kpis.dayTrades)} detail={`${data.kpis.dayTenX} cleared 10× fees`} icon={Target} />
            <StatCard label="All stored trades" value={String(data.kpis.allTimeTrades)} detail={formatSignedUsd(data.kpis.allTimeNetUsd)} icon={Activity} />
          </div>
          {data.kpis.dayTrades === 0 ? (
            <StateMessage title="No paper trades on this Phoenix day" body="Zero here means the ledger has no rows for the selected day. It is not a filled P&L." />
          ) : null}
          <div className="grid gap-6 xl:grid-cols-12">
            <Panel title="Phoenix-day trajectory" className="xl:col-span-8">
              {data.trajectory.length === 0 ? (
                <StateMessage title="No trajectory" body="Ingest a paper ledger to plot hypothetical net USD by Phoenix day." />
              ) : (
                <div className="flex h-56 items-end gap-3">
                  {data.trajectory.map((bar) => {
                    const max = Math.max(...data.trajectory.map((item) => Math.abs(item.netUsd)), 1e-9);
                    return (
                      <div key={bar.day} className="flex flex-1 flex-col items-center gap-2">
                        <div className="font-mono text-[10px] text-atom-muted">{formatSignedUsd(bar.netUsd)}</div>
                        <div className="flex h-40 w-full items-end bg-atom-bg">
                          <div className="w-full bg-atom-accent/70" style={{ height: `${(Math.abs(bar.netUsd) / max) * 100}%` }} />
                        </div>
                        <div className="font-mono text-[10px] text-atom-muted">{bar.day}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
            <Panel title="Quote quality" className="xl:col-span-4">
              <dl className="space-y-3 font-mono text-[11px]">
                <Row label="Single-DEX quotes" value={String(data.quality.opportunities)} />
                <Row label="Net-positive single-DEX" value={String(data.kpis.netPositiveQuotes)} />
                <Row label="Verified quotes" value={String(data.kpis.verifiedQuotes)} />
                <Row label="Buy/sell slot mismatch" value={String(data.quality.slotMismatch)} />
                <Row label="Jupiter circular quotes" value={String(data.kpis.circularQuoted)} />
                <Row label="Net-positive circular" value={String(data.kpis.circularNetPositive)} />
              </dl>
              <p className="mt-4 font-mono text-[10px] leading-relaxed text-atom-muted">
                A slot mismatch means the two legs were quoted in different slots. That is recorded, not treated as a fill.
              </p>
            </Panel>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="By pair">
              {data.byPair.length === 0 ? <Empty /> : <PairTable rows={data.byPair} />}
            </Panel>
            <Panel title="Coverage observed">
              {data.coverage.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2 font-mono text-[11px]">
                  {data.coverage.map((row) => (
                    <li key={row.pair} className="flex justify-between border border-atom-border px-3 py-2">
                      <span>{row.pair}</span>
                      <span className="text-atom-muted">{row.quotes} quotes · best {formatBps(row.bestGrossBps)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-atom-border/70 pb-2">
      <dt className="text-atom-muted">{label}</dt>
      <dd className="text-white">{value}</dd>
    </div>
  );
}

function PairTable({ rows }: { rows: DashboardPayload['byPair'] }) {
  return (
    <table className="w-full font-mono text-[11px]">
      <thead className="text-left text-atom-muted">
        <tr>
          <th className="pb-2 font-normal">Pair</th>
          <th className="pb-2 font-normal">Trades</th>
          <th className="pb-2 font-normal">10×</th>
          <th className="pb-2 text-right font-normal">Net USD</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.pair} className="border-t border-atom-border">
            <td className="py-2 text-white">{row.pair}</td>
            <td>{row.trades}</td>
            <td>{row.tenX}</td>
            <td className="text-right text-atom-success">{formatSignedUsd(row.netUsd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty() {
  return <p className="font-mono text-[11px] text-atom-muted">Nothing stored for this day.</p>;
}
