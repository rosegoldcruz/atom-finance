# ATOM

Arbitrage Trustless On-chain Module. A self-hosted paper desk for Solana DEX quote gaps, plus a scaffold for a read-only Aave V3 liquidation monitor.

The desk does not connect a wallet, store signing keys, or send transactions. Figures in the UI are hypothetical quote upper bounds from the scanner logs you ingest.

```
CAVEAT: upper-bound, quote-based numbers. No trade was executed. Real fills face latency,
competing searchers/MEV, pool moves between quotes, failed or landed-late transactions, and tip
auctions. Actual profit would be lower and could be negative.
```

Ledger days are America/Phoenix, matching the scanner. A row is tagged 10× fees when `net_sol + cost >= 10 × cost`. The default round trip cost is `0.000205` SOL (base fee plus two priority/tip legs from `data/samples/scanner.config.json`).

## Local setup

Requirements: Node.js 22, Postgres 16.

```bash
cp .env.example .env
```

Edit `.env` so `DATABASE_URL` points at your local Postgres, for example:

```
DATABASE_URL=postgresql://atom:atom@127.0.0.1:5432/atom
```

Do not leave `change-me` in a production `AUTH_SECRET`. For local development the API falls back to a development-only secret when `AUTH_SECRET` is unset.

```bash
npm install
npm run setup
npm run dev
```

- Web: http://localhost:3000
- API: http://127.0.0.1:8787
- Sample login, after seed: `operator@atom.local` / `paper-observer`

`npm run setup` applies migrations and loads `data/samples/*.csv`. Those files are the attached scanner logs, labeled example data. A fresh registration starts with an empty ledger and empty liquidation tables.

```bash
npm test
npm run lint
npm run build
```

## Self-hosting

See [DEPLOY.md](DEPLOY.md). `docker-compose.yml` runs `web`, `api`, and `postgres` (volume `atom_postgres`). Caddy is an optional profile:

```bash
docker compose up -d --build
docker compose --profile proxy up -d
```

## Ingestion contract

`POST /api/ingest`

```
Authorization: Bearer atom_...
Content-Type: application/json
```

```json
{
  "source": "arb-scanner",
  "batches": [
    {
      "kind": "paper_ledger",
      "rows": [
        {
          "timestamp": "2026-10-27T17:53:45-07:00",
          "pair": "SOL/USDC",
          "size_sol": "10",
          "buy_dex": "JUP-circular:Kipseli",
          "sell_dex": "JUP-circular:Deriverse",
          "net_sol": "0.000483437",
          "net_usd": "0.048916",
          "gross_bps": "0.688",
          "net_bps": "0.483",
          "window_key": "SOL/USDC|JUP-circular"
        }
      ]
    },
    { "kind": "opportunities", "rows": [] },
    { "kind": "circular", "rows": [] },
    {
      "kind": "heartbeat",
      "scanner": { "name": "arb-scanner", "status": "ok", "cycle": 4 }
    },
    {
      "kind": "aave_borrowers",
      "rows": [
        {
          "chain": "arbitrum",
          "borrower": "0xabc",
          "health_factor": "1.02",
          "collateral_usd": "1000",
          "debt_usd": "800",
          "observed_at": "2026-10-28T00:00:00Z",
          "block_number": "1"
        }
      ]
    },
    {
      "kind": "aave_liquidations",
      "rows": [
        {
          "chain": "base",
          "borrower": "0xabc",
          "tx_hash": "0xdead",
          "observed_at": "2026-10-28T00:00:00Z",
          "collateral_asset": "WETH",
          "debt_asset": "USDC",
          "bonus_captured_usd": "12.5",
          "gas_paid_native": "0.004",
          "winner": "0xwinner"
        }
      ]
    }
  ]
}
```

Column names match the scanner CSVs (`paper_ledger`, `opportunities`, `circular`). Booleans may be `true`/`false` or the CSV strings `True`/`False`. Aave chains are `arbitrum`, `base`, `optimism`, `polygon`.

Response:

```json
{ "ok": true, "results": [{ "kind": "paper_ledger", "received": 1, "inserted": 1, "skipped": 0, "errors": [] }] }
```

Repeating a post skips rows already stored. Natural keys:

- paper: timestamp + pair + size + window key
- opportunity: timestamp + cycle + pair + size + both dexes
- circular: timestamp + cycle + pair + size + both routes
- borrower: chain + borrower + observed time
- liquidation: chain + tx hash

`423` when the workspace has paused ingestion. `401` when the key is missing or revoked. Create and revoke keys in Settings. The register response shows the first key once.

Upload local CSVs without writing a client:

```bash
npm run ingest -- --url http://127.0.0.1:8787 --key "$ATOM_INGEST_KEY" \
  --ledger logs/paper_ledger.csv \
  --opportunities logs/opportunities.csv \
  --circular logs/circular.csv
```

## Environment

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Pepper for session and ingestion-key hashes |
| `APP_ORIGIN` | Public origin, used for Stripe return URLs |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` / `SEED_USER_NAME` | Optional sample workspace |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Empty until billing is turned on |
| `STRIPE_PRICE_DESK` / `STRIPE_PRICE_INSTITUTION` | Stripe price ids for the placeholder plans |
| `POSTGRES_*`, `WEB_PORT`, `ATOM_DOMAIN` | Compose only |

Copy [.env.example](.env.example). Do not commit `.env`.

## What is left for v2

- A real read-only Aave V3 watcher that posts borrower health and observed liquidations. The tables and page exist; they stay empty on purpose.
- Stripe live mode once price ids exist. Checkout returns `stripe_not_configured` until then, and the webhook can set `desk` or `institution` after a verified event.
- Multi-user roles beyond a single owner membership.
- Retention and paging for quote logs larger than a sample run.
- The scanner still cannot catch slot-level arbitrage. This product does not add execution, Jito bundles, or a hot wallet.
