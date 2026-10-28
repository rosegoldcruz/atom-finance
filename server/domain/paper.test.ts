import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  CAVEAT,
  ROUND_TRIP_COST_SOL,
  aggregatePaperTrades,
  isTenX,
  parseCsv,
  phoenixDay,
  prepareIngestBatches,
  roundTripCostSol,
} from './paper';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ledgerCsv = readFileSync(path.join(root, 'data/samples/paper_ledger.csv'), 'utf8');
const config = JSON.parse(readFileSync(path.join(root, 'data/samples/scanner.config.json'), 'utf8')) as {
  costs: { base_fee_per_sig_sol: number; signatures: number; priority_or_tip_per_leg_sol: number; legs: number };
};

describe('phoenix days', () => {
  test('keeps an offset timestamp on its Phoenix calendar day', () => {
    expect(phoenixDay('2026-10-27T17:53:45-07:00')).toBe('2026-10-27');
  });

  test('rolls a UTC timestamp back across the Phoenix midnight boundary', () => {
    expect(phoenixDay('2026-10-28T06:30:00Z')).toBe('2026-10-27');
    expect(phoenixDay('2026-10-28T07:00:00Z')).toBe('2026-10-28');
  });
});

describe('10x fee flag', () => {
  test('uses the scanner cost model: gross = net + round trip cost', () => {
    expect(roundTripCostSol(config.costs)).toBeCloseTo(ROUND_TRIP_COST_SOL, 12);
    const cost = roundTripCostSol(config.costs);
    expect(isTenX(0.034311184, cost)).toBe(true);
    expect(isTenX(0.001022274, cost)).toBe(false);
    expect(isTenX(0.000483437, cost)).toBe(false);
  });
});

describe('sample ledger', () => {
  test('parses the attached paper ledger without inventing rows', () => {
    const rows = parseCsv(ledgerCsv);
    expect(rows).toHaveLength(5);
    const prepared = prepareIngestBatches(
      [{ kind: 'paper_ledger', rows }],
      { roundTripCostSol: roundTripCostSol(config.costs) },
    );
    expect(prepared.paper).toHaveLength(5);
    expect(prepared.errors).toEqual([]);
    const flagged = prepared.paper.filter((row) => row.tenXFees);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]?.pair).toBe('SOL/USDT');
    expect(flagged[0]?.dayKey).toBe('2026-10-27');
    expect(flagged[0]?.netUsd).toBeCloseTo(3.492966, 6);

    const summary = aggregatePaperTrades(prepared.paper);
    expect(summary.trades).toBe(5);
    expect(summary.tenX).toBe(1);
    expect(summary.netUsd).toBeCloseTo(
      prepared.paper.reduce((sum, row) => sum + row.netUsd, 0),
      6,
    );
    expect(summary.byPair.map((row) => row.pair).sort()).toEqual(['SOL/USDC', 'SOL/USDT']);
    expect(summary.byDay).toEqual([
      expect.objectContaining({ day: '2026-10-27', trades: 5, tenX: 1 }),
    ]);
  });

  test('rejects a paper row that has no pair instead of filling one in', () => {
    const prepared = prepareIngestBatches(
      [{ kind: 'paper_ledger', rows: [{ timestamp: '2026-10-27T17:53:45-07:00', net_sol: '1', net_usd: '1' }] }],
      { roundTripCostSol: ROUND_TRIP_COST_SOL },
    );
    expect(prepared.paper).toHaveLength(0);
    expect(prepared.errors[0]?.message).toMatch(/pair/i);
  });

  test('dedupes a repeated paper row inside one payload', () => {
    const row = parseCsv(ledgerCsv)[0];
    const prepared = prepareIngestBatches(
      [{ kind: 'paper_ledger', rows: [row, row] }],
      { roundTripCostSol: ROUND_TRIP_COST_SOL },
    );
    expect(prepared.paper).toHaveLength(1);
    expect(prepared.errors[0]?.message).toMatch(/duplicate/i);
  });
});

describe('quote logs', () => {
  test('normalizes opportunity and circular rows and keeps profitable as a real boolean', () => {
    const prepared = prepareIngestBatches(
      [
        {
          kind: 'opportunities',
          rows: [
            {
              timestamp: '2026-10-27T17:50:02-07:00',
              cycle: '1',
              pair: 'SOL/USDC',
              size_sol: '0.5',
              buy_dex: 'Raydium CLMM',
              sell_dex: 'Meteora DLMM',
              sol_in: '0.5',
              sol_out: '0.499873668',
              gross_bps: '-2.527',
              cost_sol: '0.000205',
              net_sol: '-0.000331332',
              net_usd: '-0.033517',
              net_bps: '-6.627',
              profitable: 'False',
              verified: 'False',
              slot_buy: '462279561',
              slot_sell: '462279748',
            },
          ],
        },
        {
          kind: 'circular',
          rows: [
            {
              timestamp: '2026-10-27T17:53:45-07:00',
              cycle: '1',
              pair: 'SOL/USDC',
              size_sol: '10',
              route_out: 'Kipseli',
              route_back: 'Deriverse+BisonFi+BisonFi+TesseraV',
              sol_out: '10.000688437',
              gross_bps: '0.688',
              net_sol: '0.000483437',
              net_usd: '0.048916',
              profitable: 'True',
            },
          ],
        },
      ],
      { roundTripCostSol: ROUND_TRIP_COST_SOL },
    );
    expect(prepared.opportunities[0]).toMatchObject({
      profitable: false,
      verified: false,
      slotBuy: '462279561',
      slotSell: '462279748',
      dayKey: '2026-10-27',
    });
    expect(prepared.circular[0]).toMatchObject({
      profitable: true,
      pair: 'SOL/USDC',
      routeOut: 'Kipseli',
    });
  });
});

describe('aave scaffold rows', () => {
  test('accepts a liquidation report and rejects an unknown chain', () => {
    const prepared = prepareIngestBatches(
      [
        {
          kind: 'aave_liquidations',
          rows: [
            {
              chain: 'base',
              borrower: '0xabc',
              tx_hash: '0xdead',
              observed_at: '2026-10-27T18:00:00Z',
              collateral_asset: 'WETH',
              debt_asset: 'USDC',
              bonus_captured_usd: '12.5',
              gas_paid_native: '0.004',
              winner: '0xwinner',
            },
          ],
        },
        {
          kind: 'aave_borrowers',
          rows: [{ chain: 'solana', borrower: '0xabc', health_factor: '1.01', observed_at: '2026-10-27T18:00:00Z' }],
        },
      ],
      { roundTripCostSol: ROUND_TRIP_COST_SOL },
    );
    expect(prepared.liquidations).toHaveLength(1);
    expect(prepared.liquidations[0]).toMatchObject({
      chain: 'base',
      bonusCapturedUsd: 12.5,
      dayKey: '2026-10-27',
    });
    expect(prepared.borrowers).toHaveLength(0);
    expect(prepared.errors.some((error) => /chain/i.test(error.message))).toBe(true);
  });

  test('records a scanner heartbeat without turning it into a trade', () => {
    const prepared = prepareIngestBatches(
      [{ kind: 'heartbeat', scanner: { name: 'arb-scanner', status: 'ok', cycle: 4, seen_at: '2026-10-27T20:08:58-07:00' } }],
      { roundTripCostSol: ROUND_TRIP_COST_SOL },
    );
    expect(prepared.paper).toHaveLength(0);
    expect(prepared.heartbeats[0]).toMatchObject({ name: 'arb-scanner', status: 'ok', cycle: 4 });
  });
});

describe('caveat', () => {
  test('states that figures are quote upper bounds', () => {
    expect(CAVEAT.toLowerCase()).toContain('quote');
    expect(CAVEAT.toLowerCase()).toContain('no trade was executed');
  });
});
