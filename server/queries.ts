import type { PaperTrade, PrismaClient } from '@prisma/client';
import { AAVE_CHAINS, CAVEAT, REPORTING_TIMEZONE, currentPhoenixDay } from './domain/paper';

const ONLINE_MS = 15 * 60 * 1000;

export function tradeJson(row: PaperTrade) {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    dayKey: row.dayKey,
    pair: row.pair,
    sizeSol: row.sizeSol,
    buyDex: row.buyDex,
    sellDex: row.sellDex,
    routeKey: row.routeKey,
    netSol: row.netSol,
    netUsd: row.netUsd,
    grossBps: row.grossBps,
    netBps: row.netBps,
    windowKey: row.windowKey,
    costSol: row.costSol,
    tenXFees: row.tenXFees,
  };
}

function isJupiterTrade(row: { buyDex: string; windowKey: string }): boolean {
  return row.buyDex.startsWith('JUP-circular') || row.windowKey.includes('JUP-circular');
}

function countOf(group: { _count: { _all: number } } | undefined): number {
  return group?._count._all ?? 0;
}

function sumOf(value: number | null | undefined): number {
  return value ?? 0;
}

export async function dashboard(prisma: PrismaClient, workspaceId: string, requestedDay?: string) {
  const today = currentPhoenixDay();
  const dayGroups = await prisma.paperTrade.groupBy({
    by: ['dayKey'],
    where: { workspaceId },
    _sum: { netUsd: true, netSol: true },
    _count: { _all: true },
  });
  const tenXGroups = await prisma.paperTrade.groupBy({
    by: ['dayKey'],
    where: { workspaceId, tenXFees: true },
    _count: { _all: true },
  });
  const availableDays = dayGroups.map((group) => group.dayKey).sort();
  const selectedDay = requestedDay || availableDays[availableDays.length - 1] || today;
  const selection = requestedDay ? 'query' : availableDays.length > 0 ? 'latest_ingested_day' : 'today_empty';

  const [dayPair, dayRoute, dayTrades, quoteQuality, circularQuality, coverage] = await Promise.all([
    prisma.paperTrade.groupBy({
      by: ['pair'],
      where: { workspaceId, dayKey: selectedDay },
      _sum: { netUsd: true, netSol: true },
      _count: { _all: true },
    }),
    prisma.paperTrade.groupBy({
      by: ['pair', 'routeKey'],
      where: { workspaceId, dayKey: selectedDay },
      _sum: { netUsd: true, netSol: true },
      _count: { _all: true },
    }),
    prisma.paperTrade.findMany({
      where: { workspaceId, dayKey: selectedDay },
      orderBy: { timestamp: 'asc' },
    }),
    quoteStats(prisma, workspaceId),
    circularStats(prisma, workspaceId),
    prisma.opportunity.groupBy({
      by: ['pair'],
      where: { workspaceId },
      _max: { grossBps: true },
      _count: { _all: true },
    }),
  ]);

  const tenXByDay = new Map(tenXGroups.map((group) => [group.dayKey, countOf(group)]));
  const dayTenX = dayTrades.filter((row) => row.tenXFees).length;
  const dayNetUsd = dayTrades.reduce((sum, row) => sum + row.netUsd, 0);
  const dayNetSol = dayTrades.reduce((sum, row) => sum + row.netSol, 0);
  const todayTrades = dayGroups.find((group) => group.dayKey === today);
  const allTimeNetUsd = dayGroups.reduce((sum, group) => sum + sumOf(group._sum.netUsd), 0);
  const allTimeNetSol = dayGroups.reduce((sum, group) => sum + sumOf(group._sum.netSol), 0);
  const allTimeTrades = dayGroups.reduce((sum, group) => sum + countOf(group), 0);
  const allTimeTenX = tenXGroups.reduce((sum, group) => sum + countOf(group), 0);

  const tenXByPair = await prisma.paperTrade.groupBy({
    by: ['pair'],
    where: { workspaceId, dayKey: selectedDay, tenXFees: true },
    _count: { _all: true },
  });
  const pairTenX = new Map(tenXByPair.map((group) => [group.pair, countOf(group)]));

  let cumulative = 0;
  const intraday = dayTrades.map((row) => {
    cumulative += row.netUsd;
    return { timestamp: row.timestamp.toISOString(), cumulativeUsd: cumulative };
  });

  return {
    caveat: CAVEAT,
    timezone: REPORTING_TIMEZONE,
    today,
    selectedDay,
    selection,
    availableDays,
    kpis: {
      dayNetUsd,
      dayNetSol,
      dayTrades: dayTrades.length,
      dayTenX,
      todayNetUsd: sumOf(todayTrades?._sum.netUsd),
      todayNetSol: sumOf(todayTrades?._sum.netSol),
      todayTrades: countOf(todayTrades),
      todayTenX: tenXByDay.get(today) ?? 0,
      allTimeNetUsd,
      allTimeNetSol,
      allTimeTrades,
      allTimeTenX,
      quotedRoutes: quoteQuality.quotes,
      netPositiveQuotes: quoteQuality.profitable,
      verifiedQuotes: quoteQuality.verified,
      circularQuoted: circularQuality.quotes,
      circularNetPositive: circularQuality.profitable,
    },
    byPair: dayPair
      .map((group) => ({
        pair: group.pair,
        trades: countOf(group),
        netSol: sumOf(group._sum.netSol),
        netUsd: sumOf(group._sum.netUsd),
        tenX: pairTenX.get(group.pair) ?? 0,
      }))
      .sort((a, b) => b.netUsd - a.netUsd),
    byRoute: dayRoute
      .map((group) => ({
        route: group.routeKey,
        pair: group.pair,
        trades: countOf(group),
        netSol: sumOf(group._sum.netSol),
        netUsd: sumOf(group._sum.netUsd),
      }))
      .sort((a, b) => b.netUsd - a.netUsd),
    trajectory: [...dayGroups]
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
      .map((group) => ({
        day: group.dayKey,
        netUsd: sumOf(group._sum.netUsd),
        netSol: sumOf(group._sum.netSol),
        trades: countOf(group),
        tenX: tenXByDay.get(group.dayKey) ?? 0,
      })),
    intraday,
    latestTrades: [...dayTrades].reverse().slice(0, 12).map(tradeJson),
    coverage: coverage
      .map((group) => ({
        pair: group.pair,
        quotes: countOf(group),
        bestGrossBps: group._max.grossBps ?? 0,
      }))
      .sort((a, b) => b.quotes - a.quotes),
    quality: {
      slotMismatch: quoteQuality.slotMismatch,
      unverified: quoteQuality.quotes - quoteQuality.verified,
      opportunities: quoteQuality.quotes,
      circulars: circularQuality.quotes,
    },
  };
}

export async function listTrades(
  prisma: PrismaClient,
  workspaceId: string,
  filters: { day?: string; pair?: string; route?: string; tenx?: boolean; limit: number },
) {
  const where = {
    workspaceId,
    ...(filters.day ? { dayKey: filters.day } : {}),
    ...(filters.pair ? { pair: filters.pair } : {}),
    ...(filters.route ? { routeKey: filters.route } : {}),
    ...(filters.tenx ? { tenXFees: true } : {}),
  };
  const [trades, totals, days, pairs] = await Promise.all([
    prisma.paperTrade.findMany({ where, orderBy: { timestamp: 'desc' }, take: filters.limit }),
    prisma.paperTrade.aggregate({ where, _sum: { netUsd: true, netSol: true }, _count: { _all: true } }),
    prisma.paperTrade.groupBy({ by: ['dayKey'], where: { workspaceId }, _count: { _all: true } }),
    prisma.paperTrade.groupBy({ by: ['pair'], where: { workspaceId }, _count: { _all: true } }),
  ]);
  const tenX = await prisma.paperTrade.count({ where: { ...where, tenXFees: true } });
  return {
    caveat: CAVEAT,
    timezone: REPORTING_TIMEZONE,
    trades: trades.map(tradeJson),
    summary: {
      trades: totals._count._all,
      netUsd: sumOf(totals._sum.netUsd),
      netSol: sumOf(totals._sum.netSol),
      tenX,
    },
    days: days.map((group) => group.dayKey).sort(),
    pairs: pairs.map((group) => group.pair).sort(),
  };
}

export function tradesToCsv(trades: ReturnType<typeof tradeJson>[]): string {
  const header = [
    'timestamp',
    'phoenix_day',
    'pair',
    'size_sol',
    'buy_dex',
    'sell_dex',
    'route',
    'gross_bps',
    'net_sol',
    'net_usd',
    'ten_x_fees',
    'window_key',
    'note',
  ];
  const lines = [header.join(',')];
  for (const trade of trades) {
    lines.push(
      [
        trade.timestamp,
        trade.dayKey,
        trade.pair,
        trade.sizeSol,
        csvCell(trade.buyDex),
        csvCell(trade.sellDex),
        csvCell(trade.routeKey),
        trade.grossBps,
        trade.netSol,
        trade.netUsd,
        trade.tenXFees ? 'true' : 'false',
        csvCell(trade.windowKey),
        csvCell(CAVEAT),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export async function activityFeed(prisma: PrismaClient, workspaceId: string) {
  const [trades, batches] = await Promise.all([
    prisma.paperTrade.findMany({ where: { workspaceId }, orderBy: { timestamp: 'desc' }, take: 40 }),
    prisma.ingestionBatch.findMany({ where: { workspaceId }, orderBy: { receivedAt: 'desc' }, take: 15 }),
  ]);
  const items = [
    ...trades.map((trade) => ({
      id: trade.id,
      timestamp: trade.timestamp.toISOString(),
      kind: 'paper_trade' as const,
      severity: trade.netUsd < 0 ? ('WARNING' as const) : ('PROFIT' as const),
      title: `${trade.pair} paper ${trade.sizeSol} SOL`,
      summary: `${trade.routeKey} · net ${trade.netSol.toFixed(6)} SOL / $${trade.netUsd.toFixed(4)}`,
      tenXFees: trade.tenXFees,
      payload: tradeJson(trade),
    })),
    ...batches.map((batch) => ({
      id: batch.id,
      timestamp: batch.receivedAt.toISOString(),
      kind: 'ingestion' as const,
      severity: 'INFO' as const,
      title: `Ingest ${batch.kind}`,
      summary: `${batch.inserted} inserted, ${batch.skipped} skipped, ${batch.errorCount} errors from ${batch.source}`,
      tenXFees: false,
      payload: {
        kind: batch.kind,
        source: batch.source,
        received: batch.received,
        inserted: batch.inserted,
        skipped: batch.skipped,
        errorCount: batch.errorCount,
      },
    })),
  ].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return { caveat: CAVEAT, items: items.slice(0, 50) };
}

export async function strategies(prisma: PrismaClient, workspaceId: string, roundTripCostSol: number, tenXMultiple: number) {
  const [quotes, circular, trades, venues, borrowers, liquidations] = await Promise.all([
    quoteStats(prisma, workspaceId),
    circularStats(prisma, workspaceId),
    prisma.paperTrade.findMany({ where: { workspaceId }, select: { buyDex: true, windowKey: true, netUsd: true, tenXFees: true } }),
    prisma.opportunity.groupBy({ by: ['buyDex'], where: { workspaceId }, _count: { _all: true } }),
    prisma.borrowerSnapshot.count({ where: { workspaceId } }),
    prisma.liquidationObservation.count({ where: { workspaceId } }),
  ]);
  const jupiterTrades = trades.filter(isJupiterTrade);
  const dexTrades = trades.filter((trade) => !isJupiterTrade(trade));
  const avg = (rows: Array<{ netUsd: number }>) => (rows.length === 0 ? null : rows.reduce((sum, row) => sum + row.netUsd, 0) / rows.length);
  return {
    caveat: CAVEAT,
    venuesObserved: venues.map((venue) => venue.buyDex).sort(),
    strategies: [
      {
        id: 'jupiter-circular',
        name: 'Jupiter circular (paper)',
        status: 'watching',
        description:
          'Books the best net-positive Jupiter SOL→X→SOL quote per pair, after the scanner round-trip cost. These rows are hypothetical. They are not fills.',
        metrics: {
          quoted: circular.quotes,
          netPositive: circular.profitable,
          paperTrades: jupiterTrades.length,
          avgPaperNetUsd: avg(jupiterTrades),
          tenXTrades: jupiterTrades.filter((trade) => trade.tenXFees).length,
        },
        guardrails: {
          paperOnly: true,
          tenXMultiple,
          roundTripCostSol,
          signing: false,
        },
      },
      {
        id: 'single-dex',
        name: 'Single-DEX A→B (paper)',
        status: 'watching',
        description:
          'Direct round trips restricted to one DEX per leg. The attached sample quoted these routes and booked none of them as paper trades.',
        metrics: {
          quoted: quotes.quotes,
          netPositive: quotes.profitable,
          paperTrades: dexTrades.length,
          avgPaperNetUsd: avg(dexTrades),
          tenXTrades: dexTrades.filter((trade) => trade.tenXFees).length,
        },
        guardrails: {
          paperOnly: true,
          tenXMultiple,
          roundTripCostSol,
          signing: false,
        },
      },
      {
        id: 'aave-v3-watch',
        name: 'Aave V3 liquidation watch',
        status: borrowers + liquidations > 0 ? 'reports_received' : 'not_ingesting',
        description:
          'Read-only scaffold for borrower health factors and liquidations already observed on Arbitrum, Base, Optimism, and Polygon. No monitor is connected in this build, and this desk does not liquidate anyone.',
        metrics:
          borrowers + liquidations === 0
            ? { quoted: null, netPositive: null, paperTrades: null, avgPaperNetUsd: null, tenXTrades: null }
            : {
                quoted: borrowers,
                netPositive: liquidations,
                paperTrades: null,
                avgPaperNetUsd: null,
                tenXTrades: null,
              },
        guardrails: {
          paperOnly: true,
          chains: [...AAVE_CHAINS],
          protocol: 'aave-v3',
          signing: false,
        },
      },
    ],
  };
}

export async function bots(prisma: PrismaClient, workspaceId: string) {
  const [heartbeat, oppMeta, paperMeta, circularMeta] = await Promise.all([
    prisma.scannerHeartbeat.findFirst({ where: { workspaceId }, orderBy: { seenAt: 'desc' } }),
    prisma.opportunity.aggregate({ where: { workspaceId }, _max: { cycle: true, timestamp: true }, _count: { _all: true } }),
    prisma.paperTrade.aggregate({ where: { workspaceId }, _max: { timestamp: true }, _count: { _all: true } }),
    prisma.circularQuote.aggregate({ where: { workspaceId }, _max: { cycle: true, timestamp: true }, _count: { _all: true } }),
  ]);
  const stamps = [oppMeta._max.timestamp, paperMeta._max.timestamp, circularMeta._max.timestamp].filter((value): value is Date => value instanceof Date);
  const lastEventAt = stamps.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  let status: 'ONLINE' | 'STALE' | 'SAMPLE' | 'OFFLINE' = 'OFFLINE';
  if (heartbeat) {
    const fresh = Date.now() - heartbeat.seenAt.getTime() <= ONLINE_MS;
    const healthy = ['ok', 'running', 'online'].includes(heartbeat.status.toLowerCase());
    status = fresh && healthy ? 'ONLINE' : 'STALE';
  } else if (lastEventAt) {
    status = 'SAMPLE';
  }
  const cycles = [oppMeta._max.cycle, circularMeta._max.cycle].filter((value): value is number => typeof value === 'number');
  return {
    caveat: CAVEAT,
    scanners: [
      {
        name: heartbeat?.name || 'jupiter-paper-scanner',
        role: 'READ_ONLY_QUOTER',
        status,
        lastEventAt: lastEventAt ? lastEventAt.toISOString() : null,
        lastHeartbeatAt: heartbeat ? heartbeat.seenAt.toISOString() : null,
        cyclesObserved: cycles.length ? Math.max(...cycles) : null,
        quoteCount: oppMeta._count._all + circularMeta._count._all,
        paperTrades: paperMeta._count._all,
        region: null,
        note:
          status === 'ONLINE'
            ? 'Heartbeat is recent. This process only posts quotes. It cannot sign or send transactions.'
            : 'Status comes from stored ingestion timestamps. Sample logs are not a live process, and no executor is connected.',
      },
    ],
  };
}

export async function liquidations(prisma: PrismaClient, workspaceId: string) {
  const [borrowers, events] = await Promise.all([
    prisma.borrowerSnapshot.findMany({ where: { workspaceId }, orderBy: { observedAt: 'desc' }, take: 200 }),
    prisma.liquidationObservation.findMany({ where: { workspaceId }, orderBy: { observedAt: 'desc' }, take: 200 }),
  ]);
  return {
    caveat: CAVEAT,
    monitor: {
      status: borrowers.length + events.length === 0 ? 'not_connected' : 'reports_received',
      protocol: 'aave-v3',
      mode: 'read_only',
      chains: [...AAVE_CHAINS],
    },
    borrowers: borrowers.map((row) => ({
      id: row.id,
      chain: row.chain,
      protocol: row.protocol,
      borrower: row.borrower,
      healthFactor: row.healthFactor,
      collateralUsd: row.collateralUsd,
      debtUsd: row.debtUsd,
      observedAt: row.observedAt.toISOString(),
      dayKey: row.dayKey,
      blockNumber: row.blockNumber,
    })),
    liquidations: events.map((row) => ({
      id: row.id,
      chain: row.chain,
      protocol: row.protocol,
      borrower: row.borrower,
      txHash: row.txHash,
      observedAt: row.observedAt.toISOString(),
      dayKey: row.dayKey,
      collateralAsset: row.collateralAsset,
      debtAsset: row.debtAsset,
      bonusCapturedUsd: row.bonusCapturedUsd,
      gasPaidNative: row.gasPaidNative,
      winner: row.winner,
    })),
    schema: {
      borrowers: ['chain', 'borrower', 'health_factor', 'collateral_usd', 'debt_usd', 'observed_at', 'block_number'],
      liquidations: ['chain', 'borrower', 'tx_hash', 'observed_at', 'collateral_asset', 'debt_asset', 'bonus_captured_usd', 'gas_paid_native', 'winner'],
    },
  };
}

async function quoteStats(prisma: PrismaClient, workspaceId: string) {
  const rows = await prisma.$queryRaw<Array<{ quotes: number; profitable: number; verified: number; slotMismatch: number }>>`
    SELECT
      COUNT(*)::int AS quotes,
      COUNT(*) FILTER (WHERE profitable)::int AS profitable,
      COUNT(*) FILTER (WHERE verified)::int AS verified,
      COUNT(*) FILTER (WHERE "slotBuy" IS DISTINCT FROM "slotSell")::int AS "slotMismatch"
    FROM "Opportunity"
    WHERE "workspaceId" = ${workspaceId}
  `;
  const row = rows[0];
  return {
    quotes: Number(row?.quotes ?? 0),
    profitable: Number(row?.profitable ?? 0),
    verified: Number(row?.verified ?? 0),
    slotMismatch: Number(row?.slotMismatch ?? 0),
  };
}

async function circularStats(prisma: PrismaClient, workspaceId: string) {
  const rows = await prisma.$queryRaw<Array<{ quotes: number; profitable: number }>>`
    SELECT
      COUNT(*)::int AS quotes,
      COUNT(*) FILTER (WHERE profitable)::int AS profitable
    FROM "CircularQuote"
    WHERE "workspaceId" = ${workspaceId}
  `;
  return {
    quotes: Number(rows[0]?.quotes ?? 0),
    profitable: Number(rows[0]?.profitable ?? 0),
  };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
