export type SessionPayload = {
  user: { id: string; email: string; name: string };
  workspace: WorkspacePayload;
  caveat: string;
};

export type WorkspacePayload = {
  id: string;
  name: string;
  plan: string;
  timezone: string;
  crtOverlay: boolean;
  soundEnabled: boolean;
  ingestionPaused: boolean;
  roundTripCostSol: number;
  tenXMultiple: number;
};

export type PaperTrade = {
  id: string;
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

export type DashboardPayload = {
  caveat: string;
  timezone: string;
  today: string;
  selectedDay: string;
  selection: string;
  availableDays: string[];
  kpis: {
    dayNetUsd: number;
    dayNetSol: number;
    dayTrades: number;
    dayTenX: number;
    todayNetUsd: number;
    todayTrades: number;
    allTimeNetUsd: number;
    allTimeNetSol: number;
    allTimeTrades: number;
    allTimeTenX: number;
    quotedRoutes: number;
    netPositiveQuotes: number;
    verifiedQuotes: number;
    circularQuoted: number;
    circularNetPositive: number;
  };
  byPair: Array<{ pair: string; trades: number; netSol: number; netUsd: number; tenX: number }>;
  byRoute: Array<{ route: string; pair: string; trades: number; netSol: number; netUsd: number }>;
  trajectory: Array<{ day: string; netUsd: number; netSol: number; trades: number; tenX: number }>;
  intraday: Array<{ timestamp: string; cumulativeUsd: number }>;
  latestTrades: PaperTrade[];
  coverage: Array<{ pair: string; quotes: number; bestGrossBps: number }>;
  quality: { slotMismatch: number; unverified: number; opportunities: number; circulars: number };
};

export type ActivityPayload = {
  caveat: string;
  items: Array<{
    id: string;
    timestamp: string;
    kind: string;
    severity: string;
    title: string;
    summary: string;
    tenXFees: boolean;
    payload: Record<string, unknown>;
  }>;
};

export type StrategyMetrics = {
  quoted: number | null;
  netPositive: number | null;
  paperTrades: number | null;
  avgPaperNetUsd: number | null;
  tenXTrades: number | null;
};

export type StrategiesPayload = {
  caveat: string;
  venuesObserved: string[];
  strategies: Array<{
    id: string;
    name: string;
    status: string;
    description: string;
    metrics: StrategyMetrics;
    guardrails: Record<string, unknown>;
  }>;
};

export type BotsPayload = {
  caveat: string;
  scanners: Array<{
    name: string;
    role: string;
    status: 'ONLINE' | 'STALE' | 'SAMPLE' | 'OFFLINE';
    lastEventAt: string | null;
    lastHeartbeatAt: string | null;
    cyclesObserved: number | null;
    quoteCount: number;
    paperTrades: number;
    region: null;
    note: string;
  }>;
};

export type LiquidationsPayload = {
  caveat: string;
  monitor: { status: string; protocol: string; mode: string; chains: string[] };
  borrowers: Array<{
    id: string;
    chain: string;
    borrower: string;
    healthFactor: number;
    collateralUsd: number | null;
    debtUsd: number | null;
    observedAt: string;
    blockNumber: number | null;
  }>;
  liquidations: Array<{
    id: string;
    chain: string;
    borrower: string;
    txHash: string;
    observedAt: string;
    collateralAsset: string;
    debtAsset: string;
    bonusCapturedUsd: number | null;
    gasPaidNative: number | null;
    winner: string | null;
  }>;
  schema: { borrowers: string[]; liquidations: string[] };
};

export type TradesPayload = {
  caveat: string;
  timezone: string;
  trades: PaperTrade[];
  summary: { trades: number; netUsd: number; netSol: number; tenX: number };
  days: string[];
  pairs: string[];
};

export type SafetyPayload = {
  paperOnlyLocked: boolean;
  signingEnabled: boolean;
  walletConnected: boolean;
  privateKeysStored: boolean;
  ingestionPaused: boolean;
  tenXMultiple: number;
  roundTripCostSol: number;
  tenXGrossSol: number;
  timezone: string;
  caveat: string;
};

export type SettingsPayload = {
  user: { id: string; email: string; name: string };
  workspace: WorkspacePayload;
  ingestionKeys: Array<{ id: string; name: string; prefix: string; createdAt: string }>;
  build: { version: string; mode: string };
};

export type PlansPayload = {
  plans: Array<{
    id: string;
    name: string;
    priceMonthlyUsd: number;
    summary: string;
    features: string[];
    checkoutReady: boolean;
  }>;
  stripeConfigured: boolean;
};
