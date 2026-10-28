import { useMemo, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Caveat, PageHeader, StatCard, StateMessage } from '../components/ui';
import { formatBps, formatPhoenix, formatSignedUsd, formatSol } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { TradesPayload } from '../types';
import { DollarSign, Target, Zap } from 'lucide-react';

export function ProfitPage() {
  const [day, setDay] = useState('');
  const [pair, setPair] = useState('');
  const [tenx, setTenx] = useState(false);
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (day) params.set('day', day);
    if (pair) params.set('pair', pair);
    if (tenx) params.set('tenx', '1');
    const query = params.toString();
    return query ? `/api/trades?${query}` : '/api/trades';
  }, [day, pair, tenx]);
  const { data, error, loading } = useApi<TradesPayload>(path);
  const exportHref = path.replace('/api/trades', '/api/trades.csv');

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader icon={ReceiptText} title="PROFIT LOG" subtitle="Per day, pair, and route · America/Phoenix">
        <a href={exportHref} className="border border-atom-border px-4 py-2 font-mono text-[11px] uppercase text-white">
          Export CSV
        </a>
      </PageHeader>
      {data ? <Caveat text={data.caveat} /> : null}
      {loading && !data ? <StateMessage title="Loading paper trades" body="Reading the stored ledger." /> : null}
      {error ? <StateMessage title="Ledger unavailable" body={error} /> : null}
      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Filtered net USD" value={formatSignedUsd(data.summary.netUsd)} detail="hypothetical" icon={DollarSign} />
            <StatCard label="Filtered net SOL" value={formatSol(data.summary.netSol)} icon={Zap} />
            <StatCard label="10× fee clears" value={String(data.summary.tenX)} detail={`${data.summary.trades} trades`} icon={Target} />
          </div>
          <div className="flex flex-wrap gap-3 font-mono text-[11px]">
            <select value={day} onChange={(event) => setDay(event.target.value)} className="border border-atom-border bg-atom-bg px-3 py-2 text-white">
              <option value="">All Phoenix days</option>
              {data.days.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={pair} onChange={(event) => setPair(event.target.value)} className="border border-atom-border bg-atom-bg px-3 py-2 text-white">
              <option value="">All pairs</option>
              {data.pairs.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-atom-muted">
              <input type="checkbox" checked={tenx} onChange={(event) => setTenx(event.target.checked)} />
              10× fees only
            </label>
          </div>
          {data.trades.length === 0 ? (
            <StateMessage title="No matching paper trades" body="The filter matches nothing in the stored ledger." />
          ) : (
            <div className="overflow-x-auto border border-atom-border">
              <table className="min-w-full font-mono text-[11px]">
                <thead className="bg-atom-card text-left text-atom-muted">
                  <tr>
                    {['Phoenix time', 'Pair', 'Size', 'Route', 'Gross', 'Net SOL', 'Net USD', '10×'].map((heading) => (
                      <th key={heading} className="px-3 py-2 font-normal uppercase">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.trades.map((trade) => (
                    <tr key={trade.id} className="border-t border-atom-border">
                      <td className="px-3 py-2 whitespace-nowrap">{formatPhoenix(trade.timestamp)}</td>
                      <td className="px-3 py-2 text-white">{trade.pair}</td>
                      <td className="px-3 py-2">{trade.sizeSol}</td>
                      <td className="max-w-xs truncate px-3 py-2" title={trade.routeKey}>{trade.routeKey}</td>
                      <td className="px-3 py-2">{formatBps(trade.grossBps)}</td>
                      <td className="px-3 py-2">{trade.netSol.toFixed(6)}</td>
                      <td className="px-3 py-2 text-atom-success">{formatSignedUsd(trade.netUsd)}</td>
                      <td className="px-3 py-2">{trade.tenXFees ? 'yes' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
