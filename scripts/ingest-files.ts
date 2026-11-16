import { readFileSync } from 'node:fs';
import { parseCsv } from '../server/domain/paper';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (key?.startsWith('--') && value && !value.startsWith('--')) {
    args.set(key.slice(2), value);
    i += 1;
  }
}

const url = args.get('url') || 'http://127.0.0.1:8787';
const key = args.get('key') || process.env.ATOM_INGEST_KEY;
if (!key) {
  console.error('Pass --key or set ATOM_INGEST_KEY. This script only uploads local CSV logs.');
  process.exit(1);
}

const batches = [];
const ledger = args.get('ledger');
const opportunities = args.get('opportunities');
const circular = args.get('circular');
if (ledger) batches.push({ kind: 'paper_ledger', rows: parseCsv(readFileSync(ledger, 'utf8')) });
if (opportunities) batches.push({ kind: 'opportunities', rows: parseCsv(readFileSync(opportunities, 'utf8')) });
if (circular) batches.push({ kind: 'circular', rows: parseCsv(readFileSync(circular, 'utf8')) });
if (batches.length === 0) {
  console.error('Pass at least one of --ledger, --opportunities, --circular.');
  process.exit(1);
}

const response = await fetch(`${url.replace(/\/$/, '')}/api/ingest`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({ source: 'arb-scanner', batches }),
});
const body = await response.text();
console.log(response.status, body);
if (!response.ok) process.exit(1);
