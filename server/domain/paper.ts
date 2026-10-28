export const CAVEAT =
  'CAVEAT: upper-bound, quote-based numbers. No trade was executed. Real fills face latency, competing searchers/MEV, pool moves between quotes, failed or landed-late transactions, and tip auctions. Actual profit would be lower and could be negative.';

export const ROUND_TRIP_COST_SOL = 0.000205;
export const TEN_X_MULTIPLE = 10;
export const REPORTING_TIMEZONE = 'America/Phoenix';
export const AAVE_CHAINS = ['arbitrum', 'base', 'optimism', 'polygon'] as const;

export type AaveChain = (typeof AAVE_CHAINS)[number];

export type CostConfig = {
  base_fee_per_sig_sol: number;
  signatures: number;
  priority_or_tip_per_leg_sol: number;
  legs: number;
};

export type PaperTradeRow = {
  dedupeKey: string;
  timestamp: string;
  dayKey: string;
  pair: string;
  sizeSol: number;
  buyDex: string;
  sellDex: string;
  routeKey: string;
  netSol: number;
  netUsd: number;
  grossBps: number;
  netBps: number | null;
  windowKey: string;
  costSol: number;
  tenXFees: boolean;
};

export type OpportunityRow = {
  dedupeKey: string;
  timestamp: string;
  dayKey: string;
  cycle: number;
  pair: string;
  sizeSol: number;
  buyDex: string;
  sellDex: string;
  solIn: number;
  solOut: number;
  grossBps: number;
  costSol: number;
  netSol: number;
  netUsd: number;
  netBps: number | null;
  profitable: boolean;
  verified: boolean;
  slotBuy: string | null;
  slotSell: string | null;
};

export type CircularRow = {
  dedupeKey: string;
  timestamp: string;
  dayKey: string;
  cycle: number;
  pair: string;
  sizeSol: number;
  routeOut: string;
  routeBack: string;
  solOut: number;
  grossBps: number;
  netSol: number;
  netUsd: number;
  profitable: boolean;
  costSol: number;
  tenXFees: boolean;
};

export type BorrowerRow = {
  dedupeKey: string;
  chain: AaveChain;
  protocol: 'aave-v3';
  borrower: string;
  healthFactor: number;
  collateralUsd: number | null;
  debtUsd: number | null;
  observedAt: string;
  dayKey: string;
  blockNumber: number | null;
};

export type LiquidationRow = {
  dedupeKey: string;
  chain: AaveChain;
  protocol: 'aave-v3';
  borrower: string;
  txHash: string;
  observedAt: string;
  dayKey: string;
  collateralAsset: string;
  debtAsset: string;
  bonusCapturedUsd: number | null;
  gasPaidNative: number | null;
  winner: string | null;
};

export type HeartbeatRow = {
  name: string;
  status: string;
  cycle: number | null;
  note: string | null;
  seenAt: string;
};

export type IngestError = { kind: string; index: number; message: string };

export type PreparedIngest = {
  paper: PaperTradeRow[];
  opportunities: OpportunityRow[];
  circular: CircularRow[];
  borrowers: BorrowerRow[];
  liquidations: LiquidationRow[];
  heartbeats: HeartbeatRow[];
  errors: IngestError[];
};

type LooseRow = Record<string, unknown>;

export function phoenixDay(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error('invalid timestamp');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORTING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('invalid timestamp');
  }
  return `${year}-${month}-${day}`;
}

export function formatPhoenix(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: REPORTING_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(date);
}

export function currentPhoenixDay(now = new Date()): string {
  return phoenixDay(now);
}

export function roundTripCostSol(costs: CostConfig): number {
  return costs.base_fee_per_sig_sol * costs.signatures + costs.priority_or_tip_per_leg_sol * costs.legs;
}

export function isTenX(netSol: number, costSol: number, multiple = TEN_X_MULTIPLE): boolean {
  if (!(costSol > 0)) return false;
  return netSol + costSol >= multiple * costSol;
}

export function parseCsv(text: string): LooseRow[] {
  const rows = parseCsvRecords(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((cell) => cell.trim());
  return rows.slice(1).filter((record) => record.some((cell) => cell.trim() !== '')).map((record) => {
    const row: LooseRow = {};
    header.forEach((key, index) => {
      row[key] = record[index] ?? '';
    });
    return row;
  });
}

export function prepareIngestBatches(
  batches: Array<{ kind: string; rows?: unknown[]; scanner?: LooseRow }>,
  options: { roundTripCostSol: number },
): PreparedIngest {
  const prepared: PreparedIngest = {
    paper: [],
    opportunities: [],
    circular: [],
    borrowers: [],
    liquidations: [],
    heartbeats: [],
    errors: [],
  };
  const seen = new Set<string>();

  batches.forEach((batch) => {
    if (batch.kind === 'heartbeat') {
      const heartbeat = normalizeHeartbeat(batch.scanner ?? {});
      if ('error' in heartbeat) {
        prepared.errors.push({ kind: batch.kind, index: 0, message: heartbeat.error });
      } else {
        prepared.heartbeats.push(heartbeat);
      }
      return;
    }

    const rows = Array.isArray(batch.rows) ? batch.rows : [];
    rows.forEach((raw, index) => {
      const row = asRecord(raw);
      if (!row) {
        prepared.errors.push({ kind: batch.kind, index, message: 'row must be an object' });
        return;
      }
      const parsed = normalizeRow(batch.kind, row, options.roundTripCostSol);
      if ('error' in parsed) {
        prepared.errors.push({ kind: batch.kind, index, message: parsed.error });
        return;
      }
      if (seen.has(parsed.dedupeKey)) {
        prepared.errors.push({ kind: batch.kind, index, message: `duplicate row ${parsed.dedupeKey}` });
        return;
      }
      seen.add(parsed.dedupeKey);
      pushParsed(prepared, parsed);
    });
  });

  return prepared;
}

export function aggregatePaperTrades(rows: PaperTradeRow[]) {
  const byPair = new Map<string, { pair: string; trades: number; netSol: number; netUsd: number; tenX: number }>();
  const byRoute = new Map<string, { route: string; pair: string; trades: number; netSol: number; netUsd: number; tenX: number }>();
  const byDay = new Map<string, { day: string; trades: number; netSol: number; netUsd: number; tenX: number }>();
  let netSol = 0;
  let netUsd = 0;
  let tenX = 0;

  for (const row of rows) {
    netSol += row.netSol;
    netUsd += row.netUsd;
    if (row.tenXFees) tenX += 1;
    const pair = byPair.get(row.pair) ?? { pair: row.pair, trades: 0, netSol: 0, netUsd: 0, tenX: 0 };
    pair.trades += 1;
    pair.netSol += row.netSol;
    pair.netUsd += row.netUsd;
    if (row.tenXFees) pair.tenX += 1;
    byPair.set(row.pair, pair);

    const routeKey = `${row.pair}|${row.routeKey}`;
    const route = byRoute.get(routeKey) ?? { route: row.routeKey, pair: row.pair, trades: 0, netSol: 0, netUsd: 0, tenX: 0 };
    route.trades += 1;
    route.netSol += row.netSol;
    route.netUsd += row.netUsd;
    if (row.tenXFees) route.tenX += 1;
    byRoute.set(routeKey, route);

    const day = byDay.get(row.dayKey) ?? { day: row.dayKey, trades: 0, netSol: 0, netUsd: 0, tenX: 0 };
    day.trades += 1;
    day.netSol += row.netSol;
    day.netUsd += row.netUsd;
    if (row.tenXFees) day.tenX += 1;
    byDay.set(row.dayKey, day);
  }

  return {
    trades: rows.length,
    tenX,
    netSol,
    netUsd,
    byPair: [...byPair.values()].sort((a, b) => b.netUsd - a.netUsd),
    byRoute: [...byRoute.values()].sort((a, b) => b.netUsd - a.netUsd),
    byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}

type Parsed =
  | ({ table: 'paper' } & PaperTradeRow)
  | ({ table: 'opportunities' } & OpportunityRow)
  | ({ table: 'circular' } & CircularRow)
  | ({ table: 'borrowers' } & BorrowerRow)
  | ({ table: 'liquidations' } & LiquidationRow);

function pushParsed(prepared: PreparedIngest, parsed: Parsed) {
  if (parsed.table === 'paper') prepared.paper.push(parsed);
  if (parsed.table === 'opportunities') prepared.opportunities.push(parsed);
  if (parsed.table === 'circular') prepared.circular.push(parsed);
  if (parsed.table === 'borrowers') prepared.borrowers.push(parsed);
  if (parsed.table === 'liquidations') prepared.liquidations.push(parsed);
}

function normalizeRow(kind: string, row: LooseRow, costDefault: number): Parsed | { error: string } {
  if (kind === 'paper_ledger') return normalizePaper(row, costDefault);
  if (kind === 'opportunities') return normalizeOpportunity(row);
  if (kind === 'circular') return normalizeCircular(row, costDefault);
  if (kind === 'aave_borrowers') return normalizeBorrower(row);
  if (kind === 'aave_liquidations') return normalizeLiquidation(row);
  return { error: `unknown batch kind ${kind}` };
}

function normalizePaper(row: LooseRow, costDefault: number): ({ table: 'paper' } & PaperTradeRow) | { error: string } {
  const timestamp = readString(row, 'timestamp');
  const pair = readString(row, 'pair');
  const buyDex = readString(row, 'buy_dex');
  const sellDex = readString(row, 'sell_dex');
  const windowKey = readString(row, 'window_key');
  const sizeSol = readNumber(row, 'size_sol');
  const netSol = readNumber(row, 'net_sol');
  const netUsd = readNumber(row, 'net_usd');
  const grossBps = readNumber(row, 'gross_bps');
  if (!timestamp) return { error: 'missing timestamp' };
  if (!pair) return { error: 'missing pair' };
  if (!buyDex) return { error: 'missing buy_dex' };
  if (!sellDex) return { error: 'missing sell_dex' };
  if (!windowKey) return { error: 'missing window_key' };
  if (sizeSol === null) return { error: 'missing size_sol' };
  if (netSol === null) return { error: 'missing net_sol' };
  if (netUsd === null) return { error: 'missing net_usd' };
  if (grossBps === null) return { error: 'missing gross_bps' };
  const iso = parseTimestamp(timestamp);
  if ('error' in iso) return iso;
  const costSol = optionalNumber(row, 'cost_sol') ?? costDefault;
  const routeKey = `${buyDex} → ${sellDex}`;
  const dedupeKey = ['paper', iso.iso, pair, String(sizeSol), windowKey].join('|');
  return {
    table: 'paper',
    dedupeKey,
    timestamp: iso.iso,
    dayKey: phoenixDay(iso.iso),
    pair,
    sizeSol,
    buyDex,
    sellDex,
    routeKey,
    netSol,
    netUsd,
    grossBps,
    netBps: optionalNumber(row, 'net_bps'),
    windowKey,
    costSol,
    tenXFees: isTenX(netSol, costSol),
  };
}

function normalizeOpportunity(row: LooseRow): ({ table: 'opportunities' } & OpportunityRow) | { error: string } {
  const timestamp = readString(row, 'timestamp');
  const pair = readString(row, 'pair');
  const buyDex = readString(row, 'buy_dex');
  const sellDex = readString(row, 'sell_dex');
  const cycle = readNumber(row, 'cycle');
  const sizeSol = readNumber(row, 'size_sol');
  const solIn = readNumber(row, 'sol_in');
  const solOut = readNumber(row, 'sol_out');
  const grossBps = readNumber(row, 'gross_bps');
  const costSol = readNumber(row, 'cost_sol');
  const netSol = readNumber(row, 'net_sol');
  const netUsd = readNumber(row, 'net_usd');
  if (!timestamp) return { error: 'missing timestamp' };
  if (!pair) return { error: 'missing pair' };
  if (!buyDex) return { error: 'missing buy_dex' };
  if (!sellDex) return { error: 'missing sell_dex' };
  if (cycle === null) return { error: 'missing cycle' };
  if (sizeSol === null) return { error: 'missing size_sol' };
  if (solIn === null) return { error: 'missing sol_in' };
  if (solOut === null) return { error: 'missing sol_out' };
  if (grossBps === null) return { error: 'missing gross_bps' };
  if (costSol === null) return { error: 'missing cost_sol' };
  if (netSol === null) return { error: 'missing net_sol' };
  if (netUsd === null) return { error: 'missing net_usd' };
  const iso = parseTimestamp(timestamp);
  if ('error' in iso) return iso;
  return {
    table: 'opportunities',
    dedupeKey: ['opp', iso.iso, String(cycle), pair, String(sizeSol), buyDex, sellDex].join('|'),
    timestamp: iso.iso,
    dayKey: phoenixDay(iso.iso),
    cycle,
    pair,
    sizeSol,
    buyDex,
    sellDex,
    solIn,
    solOut,
    grossBps,
    costSol,
    netSol,
    netUsd,
    netBps: optionalNumber(row, 'net_bps'),
    profitable: asBool(row.profitable),
    verified: asBool(row.verified),
    slotBuy: optionalString(row, 'slot_buy'),
    slotSell: optionalString(row, 'slot_sell'),
  };
}

function normalizeCircular(row: LooseRow, costDefault: number): ({ table: 'circular' } & CircularRow) | { error: string } {
  const timestamp = readString(row, 'timestamp');
  const pair = readString(row, 'pair');
  const routeOut = readString(row, 'route_out');
  const routeBack = readString(row, 'route_back');
  const cycle = readNumber(row, 'cycle');
  const sizeSol = readNumber(row, 'size_sol');
  const solOut = readNumber(row, 'sol_out');
  const grossBps = readNumber(row, 'gross_bps');
  const netSol = readNumber(row, 'net_sol');
  const netUsd = readNumber(row, 'net_usd');
  if (!timestamp) return { error: 'missing timestamp' };
  if (!pair) return { error: 'missing pair' };
  if (!routeOut) return { error: 'missing route_out' };
  if (!routeBack) return { error: 'missing route_back' };
  if (cycle === null) return { error: 'missing cycle' };
  if (sizeSol === null) return { error: 'missing size_sol' };
  if (solOut === null) return { error: 'missing sol_out' };
  if (grossBps === null) return { error: 'missing gross_bps' };
  if (netSol === null) return { error: 'missing net_sol' };
  if (netUsd === null) return { error: 'missing net_usd' };
  const iso = parseTimestamp(timestamp);
  if ('error' in iso) return iso;
  const costSol = optionalNumber(row, 'cost_sol') ?? costDefault;
  return {
    table: 'circular',
    dedupeKey: ['circ', iso.iso, String(cycle), pair, String(sizeSol), routeOut, routeBack].join('|'),
    timestamp: iso.iso,
    dayKey: phoenixDay(iso.iso),
    cycle,
    pair,
    sizeSol,
    routeOut,
    routeBack,
    solOut,
    grossBps,
    netSol,
    netUsd,
    profitable: asBool(row.profitable),
    costSol,
    tenXFees: isTenX(netSol, costSol),
  };
}

function normalizeBorrower(row: LooseRow): ({ table: 'borrowers' } & BorrowerRow) | { error: string } {
  const chain = readChain(row);
  if ('error' in chain) return chain;
  const borrower = readString(row, 'borrower');
  const healthFactor = readNumber(row, 'health_factor');
  const observed = readString(row, 'observed_at');
  if (!borrower) return { error: 'missing borrower' };
  if (healthFactor === null) return { error: 'missing health_factor' };
  if (!observed) return { error: 'missing observed_at' };
  const iso = parseTimestamp(observed);
  if ('error' in iso) return iso;
  return {
    table: 'borrowers',
    dedupeKey: ['borrower', chain.chain, borrower, iso.iso].join('|'),
    chain: chain.chain,
    protocol: 'aave-v3',
    borrower,
    healthFactor,
    collateralUsd: optionalNumber(row, 'collateral_usd'),
    debtUsd: optionalNumber(row, 'debt_usd'),
    observedAt: iso.iso,
    dayKey: phoenixDay(iso.iso),
    blockNumber: optionalNumber(row, 'block_number'),
  };
}

function normalizeLiquidation(row: LooseRow): ({ table: 'liquidations' } & LiquidationRow) | { error: string } {
  const chain = readChain(row);
  if ('error' in chain) return chain;
  const borrower = readString(row, 'borrower');
  const txHash = readString(row, 'tx_hash');
  const observed = readString(row, 'observed_at');
  const collateralAsset = readString(row, 'collateral_asset');
  const debtAsset = readString(row, 'debt_asset');
  if (!borrower) return { error: 'missing borrower' };
  if (!txHash) return { error: 'missing tx_hash' };
  if (!observed) return { error: 'missing observed_at' };
  if (!collateralAsset) return { error: 'missing collateral_asset' };
  if (!debtAsset) return { error: 'missing debt_asset' };
  const iso = parseTimestamp(observed);
  if ('error' in iso) return iso;
  return {
    table: 'liquidations',
    dedupeKey: ['liq', chain.chain, txHash.toLowerCase()].join('|'),
    chain: chain.chain,
    protocol: 'aave-v3',
    borrower,
    txHash,
    observedAt: iso.iso,
    dayKey: phoenixDay(iso.iso),
    collateralAsset,
    debtAsset,
    bonusCapturedUsd: optionalNumber(row, 'bonus_captured_usd'),
    gasPaidNative: optionalNumber(row, 'gas_paid_native'),
    winner: optionalString(row, 'winner'),
  };
}

function normalizeHeartbeat(scanner: LooseRow): HeartbeatRow | { error: string } {
  const name = readString(scanner, 'name');
  const status = readString(scanner, 'status');
  if (!name) return { error: 'missing name' };
  if (!status) return { error: 'missing status' };
  const seenRaw = optionalString(scanner, 'seen_at') ?? optionalString(scanner, 'seenAt');
  const seenAt = seenRaw ? parseTimestamp(seenRaw) : { iso: new Date().toISOString() };
  if ('error' in seenAt) return seenAt;
  return {
    name,
    status,
    cycle: optionalNumber(scanner, 'cycle'),
    note: optionalString(scanner, 'note'),
    seenAt: seenAt.iso,
  };
}

function readChain(row: LooseRow): { chain: AaveChain } | { error: string } {
  const value = optionalString(row, 'chain');
  if (!value) return { error: 'missing chain' };
  const chain = value.toLowerCase();
  if (!AAVE_CHAINS.includes(chain as AaveChain)) return { error: `unsupported chain ${value}` };
  return { chain: chain as AaveChain };
}

function parseTimestamp(value: string): { iso: string } | { error: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: `invalid timestamp ${value}` };
  return { iso: date.toISOString() };
}

function readString(row: LooseRow, key: string): string | null {
  return optionalString(row, key);
}

function readNumber(row: LooseRow, key: string): number | null {
  return optionalNumber(row, key);
}

function optionalString(row: LooseRow, key: string): string | null {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function optionalNumber(row: LooseRow, key: string): number | null {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
  return false;
}

function asRecord(value: unknown): LooseRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as LooseRow;
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      records.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    records.push(row);
  }
  return records;
}
