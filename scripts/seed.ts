import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { hashPassword, hashToken, newIngestionKey } from '../server/auth/crypto';
import { parseCsv, roundTripCostSol, type CostConfig } from '../server/domain/paper';
import { applyIngest } from '../server/ingest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const email = (process.env.SEED_USER_EMAIL || 'operator@atom.local').toLowerCase();
const password = process.env.SEED_USER_PASSWORD || 'paper-observer';
const name = process.env.SEED_USER_NAME || 'Operator';

if (process.env.NODE_ENV === 'production' && password === 'paper-observer') {
  console.error('Refusing to seed the local demo password in production. Set SEED_USER_PASSWORD.');
  process.exit(1);
}

const prisma = new PrismaClient();
const config = JSON.parse(readFileSync(path.join(root, 'data/samples/scanner.config.json'), 'utf8')) as { costs: CostConfig };
const cost = roundTripCostSol(config.costs);

const user = await prisma.user.upsert({
  where: { email },
  update: { name },
  create: { email, name, passwordHash: await hashPassword(password) },
});

const existingMembership = await prisma.workspaceMember.findFirst({
  where: { userId: user.id },
  include: { workspace: true },
});
const membership = existingMembership ?? await (async () => {
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Sample desk',
      roundTripCostSol: cost,
      members: { create: { role: 'owner', userId: user.id } },
    },
  });
  return prisma.workspaceMember.findFirstOrThrow({
    where: { userId: user.id, workspaceId: workspace.id },
    include: { workspace: true },
  });
})();
await prisma.workspace.update({
  where: { id: membership.workspace.id },
  data: { roundTripCostSol: cost },
});

const active = await prisma.ingestionKey.findFirst({ where: { workspaceId: membership.workspace.id, revokedAt: null } });
if (!active) {
  const token = newIngestionKey();
  await prisma.ingestionKey.create({
    data: {
      workspaceId: membership.workspace.id,
      name: 'sample-scanner',
      prefix: token.slice(0, 12),
      keyHash: hashToken(token),
    },
  });
  const keyFile = path.join(root, 'data/local-ingestion-key.txt');
  writeFileSync(keyFile, `${token}\n`, { mode: 0o600 });
  console.log(`Ingestion key written to ${keyFile}`);
} else {
  console.log(`Ingestion key already exists (prefix ${active.prefix}). Not rotated.`);
}

const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: membership.workspace.id } });
const ledger = parseCsv(readFileSync(path.join(root, 'data/samples/paper_ledger.csv'), 'utf8'));
const opportunities = parseCsv(readFileSync(path.join(root, 'data/samples/opportunities.csv'), 'utf8'));
const circular = parseCsv(readFileSync(path.join(root, 'data/samples/circular.csv'), 'utf8'));
const result = await applyIngest(prisma, workspace, {
  source: 'sample-logs',
  batches: [
    { kind: 'paper_ledger', rows: ledger },
    { kind: 'opportunities', rows: opportunities },
    { kind: 'circular', rows: circular },
  ],
});

console.log(`Seeded ${email}. Sample logs are example scanner output, not live fills.`);
for (const batch of result.results) {
  console.log(`  ${batch.kind}: inserted ${batch.inserted}, skipped ${batch.skipped}, errors ${batch.errors.length}`);
}
await prisma.$disconnect();
