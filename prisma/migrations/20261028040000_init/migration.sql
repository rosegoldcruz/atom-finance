-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Phoenix',
    "plan" TEXT NOT NULL DEFAULT 'observer',
    "roundTripCostSol" DOUBLE PRECISION NOT NULL DEFAULT 0.000205,
    "tenXMultiple" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "crtOverlay" BOOLEAN NOT NULL DEFAULT true,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ingestionPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionBatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "received" INTEGER NOT NULL,
    "inserted" INTEGER NOT NULL,
    "skipped" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "dayKey" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "sizeSol" DOUBLE PRECISION NOT NULL,
    "buyDex" TEXT NOT NULL,
    "sellDex" TEXT NOT NULL,
    "routeKey" TEXT NOT NULL,
    "netSol" DOUBLE PRECISION NOT NULL,
    "netUsd" DOUBLE PRECISION NOT NULL,
    "grossBps" DOUBLE PRECISION NOT NULL,
    "netBps" DOUBLE PRECISION,
    "windowKey" TEXT NOT NULL,
    "costSol" DOUBLE PRECISION NOT NULL,
    "tenXFees" BOOLEAN NOT NULL,

    CONSTRAINT "PaperTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "dayKey" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "pair" TEXT NOT NULL,
    "sizeSol" DOUBLE PRECISION NOT NULL,
    "buyDex" TEXT NOT NULL,
    "sellDex" TEXT NOT NULL,
    "solIn" DOUBLE PRECISION NOT NULL,
    "solOut" DOUBLE PRECISION NOT NULL,
    "grossBps" DOUBLE PRECISION NOT NULL,
    "costSol" DOUBLE PRECISION NOT NULL,
    "netSol" DOUBLE PRECISION NOT NULL,
    "netUsd" DOUBLE PRECISION NOT NULL,
    "netBps" DOUBLE PRECISION,
    "profitable" BOOLEAN NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "slotBuy" TEXT,
    "slotSell" TEXT,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircularQuote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "dayKey" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "pair" TEXT NOT NULL,
    "sizeSol" DOUBLE PRECISION NOT NULL,
    "routeOut" TEXT NOT NULL,
    "routeBack" TEXT NOT NULL,
    "solOut" DOUBLE PRECISION NOT NULL,
    "grossBps" DOUBLE PRECISION NOT NULL,
    "netSol" DOUBLE PRECISION NOT NULL,
    "netUsd" DOUBLE PRECISION NOT NULL,
    "profitable" BOOLEAN NOT NULL,
    "costSol" DOUBLE PRECISION NOT NULL,
    "tenXFees" BOOLEAN NOT NULL,

    CONSTRAINT "CircularQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerHeartbeat" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cycle" INTEGER,
    "note" TEXT,
    "seenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScannerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BorrowerSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "borrower" TEXT NOT NULL,
    "healthFactor" DOUBLE PRECISION NOT NULL,
    "collateralUsd" DOUBLE PRECISION,
    "debtUsd" DOUBLE PRECISION,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "dayKey" TEXT NOT NULL,
    "blockNumber" INTEGER,

    CONSTRAINT "BorrowerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidationObservation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "borrower" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "dayKey" TEXT NOT NULL,
    "collateralAsset" TEXT NOT NULL,
    "debtAsset" TEXT NOT NULL,
    "bonusCapturedUsd" DOUBLE PRECISION,
    "gasPaidNative" DOUBLE PRECISION,
    "winner" TEXT,

    CONSTRAINT "LiquidationObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionKey_keyHash_key" ON "IngestionKey"("keyHash");

-- CreateIndex
CREATE INDEX "PaperTrade_workspaceId_dayKey_idx" ON "PaperTrade"("workspaceId", "dayKey");

-- CreateIndex
CREATE INDEX "PaperTrade_workspaceId_pair_idx" ON "PaperTrade"("workspaceId", "pair");

-- CreateIndex
CREATE UNIQUE INDEX "PaperTrade_workspaceId_dedupeKey_key" ON "PaperTrade"("workspaceId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Opportunity_workspaceId_pair_idx" ON "Opportunity"("workspaceId", "pair");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_workspaceId_dedupeKey_key" ON "Opportunity"("workspaceId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "CircularQuote_workspaceId_dedupeKey_key" ON "CircularQuote"("workspaceId", "dedupeKey");

-- CreateIndex
CREATE INDEX "ScannerHeartbeat_workspaceId_seenAt_idx" ON "ScannerHeartbeat"("workspaceId", "seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BorrowerSnapshot_workspaceId_dedupeKey_key" ON "BorrowerSnapshot"("workspaceId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidationObservation_workspaceId_dedupeKey_key" ON "LiquidationObservation"("workspaceId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionKey" ADD CONSTRAINT "IngestionKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionBatch" ADD CONSTRAINT "IngestionBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircularQuote" ADD CONSTRAINT "CircularQuote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannerHeartbeat" ADD CONSTRAINT "ScannerHeartbeat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowerSnapshot" ADD CONSTRAINT "BorrowerSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidationObservation" ADD CONSTRAINT "LiquidationObservation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

