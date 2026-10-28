import type { Prisma, PrismaClient, Workspace } from '@prisma/client';
import { prepareIngestBatches, type PreparedIngest } from './domain/paper';

type IngestBatch = {
  kind: string;
  rows?: unknown[];
  scanner?: Record<string, unknown>;
};

export type IngestRequest = {
  source?: string;
  batches: IngestBatch[];
};

type Tx = Prisma.TransactionClient;

export async function applyIngest(prisma: PrismaClient, workspace: Workspace, request: IngestRequest) {
  const source = (request.source || 'arb-scanner').slice(0, 120);
  const results = await prisma.$transaction(async (tx) => {
    const settled = [];
    for (const batch of request.batches) {
      const prepared = prepareIngestBatches([batch], { roundTripCostSol: workspace.roundTripCostSol });
      const stats = await insertPrepared(tx, workspace.id, batch.kind, prepared);
      const errors = prepared.errors.map((error) => error.message);
      const received = batch.kind === 'heartbeat' ? 1 : batch.rows?.length ?? 0;
      await tx.ingestionBatch.create({
        data: {
          workspaceId: workspace.id,
          kind: batch.kind,
          source,
          received,
          inserted: stats.inserted,
          skipped: stats.skipped,
          errorCount: errors.length,
        },
      });
      settled.push({ kind: batch.kind, received, inserted: stats.inserted, skipped: stats.skipped, errors });
    }
    return settled;
  }, { timeout: 30_000 });

  return { ok: true as const, results };
}

async function insertPrepared(tx: Tx, workspaceId: string, kind: string, prepared: PreparedIngest) {
  if (kind === 'paper_ledger') return insertPaper(tx, workspaceId, prepared);
  if (kind === 'opportunities') return insertOpportunities(tx, workspaceId, prepared);
  if (kind === 'circular') return insertCircular(tx, workspaceId, prepared);
  if (kind === 'aave_borrowers') return insertBorrowers(tx, workspaceId, prepared);
  if (kind === 'aave_liquidations') return insertLiquidations(tx, workspaceId, prepared);
  if (kind === 'heartbeat') return insertHeartbeats(tx, workspaceId, prepared);
  return { inserted: 0, skipped: 0 };
}

async function freshKeys(tx: Tx, model: 'paperTrade' | 'opportunity' | 'circularQuote' | 'borrowerSnapshot' | 'liquidationObservation', workspaceId: string, keys: string[]) {
  if (keys.length === 0) return new Set<string>();
  const delegate = tx[model] as unknown as {
    findMany: (args: { where: { workspaceId: string; dedupeKey: { in: string[] } }; select: { dedupeKey: true } }) => Promise<Array<{ dedupeKey: string }>>;
  };
  const existing = await delegate.findMany({
    where: { workspaceId, dedupeKey: { in: keys } },
    select: { dedupeKey: true },
  });
  return new Set(existing.map((row) => row.dedupeKey));
}

async function insertPaper(tx: Tx, workspaceId: string, prepared: PreparedIngest) {
  const have = await freshKeys(tx, 'paperTrade', workspaceId, prepared.paper.map((row) => row.dedupeKey));
  const fresh = prepared.paper.filter((row) => !have.has(row.dedupeKey));
  if (fresh.length > 0) {
    await tx.paperTrade.createMany({
      data: fresh.map((row) => ({
        workspaceId,
        dedupeKey: row.dedupeKey,
        timestamp: new Date(row.timestamp),
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
      })),
    });
  }
  return { inserted: fresh.length, skipped: prepared.paper.length - fresh.length };
}

async function insertOpportunities(tx: Tx, workspaceId: string, prepared: PreparedIngest) {
  const have = await freshKeys(tx, 'opportunity', workspaceId, prepared.opportunities.map((row) => row.dedupeKey));
  const fresh = prepared.opportunities.filter((row) => !have.has(row.dedupeKey));
  if (fresh.length > 0) {
    await tx.opportunity.createMany({
      data: fresh.map((row) => ({
        workspaceId,
        dedupeKey: row.dedupeKey,
        timestamp: new Date(row.timestamp),
        dayKey: row.dayKey,
        cycle: Math.round(row.cycle),
        pair: row.pair,
        sizeSol: row.sizeSol,
        buyDex: row.buyDex,
        sellDex: row.sellDex,
        solIn: row.solIn,
        solOut: row.solOut,
        grossBps: row.grossBps,
        costSol: row.costSol,
        netSol: row.netSol,
        netUsd: row.netUsd,
        netBps: row.netBps,
        profitable: row.profitable,
        verified: row.verified,
        slotBuy: row.slotBuy,
        slotSell: row.slotSell,
      })),
    });
  }
  return { inserted: fresh.length, skipped: prepared.opportunities.length - fresh.length };
}

async function insertCircular(tx: Tx, workspaceId: string, prepared: PreparedIngest) {
  const have = await freshKeys(tx, 'circularQuote', workspaceId, prepared.circular.map((row) => row.dedupeKey));
  const fresh = prepared.circular.filter((row) => !have.has(row.dedupeKey));
  if (fresh.length > 0) {
    await tx.circularQuote.createMany({
      data: fresh.map((row) => ({
        workspaceId,
        dedupeKey: row.dedupeKey,
        timestamp: new Date(row.timestamp),
        dayKey: row.dayKey,
        cycle: Math.round(row.cycle),
        pair: row.pair,
        sizeSol: row.sizeSol,
        routeOut: row.routeOut,
        routeBack: row.routeBack,
        solOut: row.solOut,
        grossBps: row.grossBps,
        netSol: row.netSol,
        netUsd: row.netUsd,
        profitable: row.profitable,
        costSol: row.costSol,
        tenXFees: row.tenXFees,
      })),
    });
  }
  return { inserted: fresh.length, skipped: prepared.circular.length - fresh.length };
}

async function insertBorrowers(tx: Tx, workspaceId: string, prepared: PreparedIngest) {
  const have = await freshKeys(tx, 'borrowerSnapshot', workspaceId, prepared.borrowers.map((row) => row.dedupeKey));
  const fresh = prepared.borrowers.filter((row) => !have.has(row.dedupeKey));
  if (fresh.length > 0) {
    await tx.borrowerSnapshot.createMany({
      data: fresh.map((row) => ({
        workspaceId,
        dedupeKey: row.dedupeKey,
        chain: row.chain,
        protocol: row.protocol,
        borrower: row.borrower,
        healthFactor: row.healthFactor,
        collateralUsd: row.collateralUsd,
        debtUsd: row.debtUsd,
        observedAt: new Date(row.observedAt),
        dayKey: row.dayKey,
        blockNumber: row.blockNumber === null ? null : Math.round(row.blockNumber),
      })),
    });
  }
  return { inserted: fresh.length, skipped: prepared.borrowers.length - fresh.length };
}

async function insertLiquidations(tx: Tx, workspaceId: string, prepared: PreparedIngest) {
  const have = await freshKeys(tx, 'liquidationObservation', workspaceId, prepared.liquidations.map((row) => row.dedupeKey));
  const fresh = prepared.liquidations.filter((row) => !have.has(row.dedupeKey));
  if (fresh.length > 0) {
    await tx.liquidationObservation.createMany({
      data: fresh.map((row) => ({
        workspaceId,
        dedupeKey: row.dedupeKey,
        chain: row.chain,
        protocol: row.protocol,
        borrower: row.borrower,
        txHash: row.txHash,
        observedAt: new Date(row.observedAt),
        dayKey: row.dayKey,
        collateralAsset: row.collateralAsset,
        debtAsset: row.debtAsset,
        bonusCapturedUsd: row.bonusCapturedUsd,
        gasPaidNative: row.gasPaidNative,
        winner: row.winner,
      })),
    });
  }
  return { inserted: fresh.length, skipped: prepared.liquidations.length - fresh.length };
}

async function insertHeartbeats(tx: Tx, workspaceId: string, prepared: PreparedIngest) {
  if (prepared.heartbeats.length === 0) return { inserted: 0, skipped: 0 };
  await tx.scannerHeartbeat.createMany({
    data: prepared.heartbeats.map((row) => ({
      workspaceId,
      name: row.name,
      status: row.status,
      cycle: row.cycle === null ? null : Math.round(row.cycle),
      note: row.note,
      seenAt: new Date(row.seenAt),
    })),
  });
  return { inserted: prepared.heartbeats.length, skipped: 0 };
}
