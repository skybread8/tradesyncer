-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "TradingFirm" AS ENUM ('TOPSTEPX', 'ALPHA_FUTURES', 'MYFUNDED_FUTURES', 'TAKEPROFIT_TRADER');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('RITHMIC', 'TRADOVATE', 'NINJATRADER', 'OTHER');

-- CreateEnum
CREATE TYPE "CopierStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('MARKET', 'LIMIT', 'STOP');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RiskScalingType" AS ENUM ('FIXED', 'PERCENTAGE', 'BALANCE_BASED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firm" "TradingFirm" NOT NULL,
    "platform" "Platform" NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountSize" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "additionalConfig" JSONB,
    "maxDrawdown" DOUBLE PRECISION,
    "dailyLossLimit" DOUBLE PRECISION,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Copier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "masterAccountId" TEXT NOT NULL,
    "status" "CopierStatus" NOT NULL DEFAULT 'STOPPED',
    "latencyToleranceMs" INTEGER NOT NULL DEFAULT 1000,
    "copyEntries" BOOLEAN NOT NULL DEFAULT true,
    "copyExits" BOOLEAN NOT NULL DEFAULT true,
    "copyModifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Copier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopierAccountConfig" (
    "id" TEXT NOT NULL,
    "copierId" TEXT NOT NULL,
    "slaveAccountId" TEXT NOT NULL,
    "scalingType" "RiskScalingType" NOT NULL DEFAULT 'FIXED',
    "fixedContracts" INTEGER,
    "percentageScale" DOUBLE PRECISION,
    "maxContracts" INTEGER,
    "dailyLossLimit" DOUBLE PRECISION,
    "autoDisable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopierAccountConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "copierId" TEXT,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "type" "TradeType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "entryPrice" DOUBLE PRECISION,
    "exitPrice" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "filledAt" TIMESTAMP(3),
    "realizedPnL" DOUBLE PRECISION DEFAULT 0,
    "externalOrderId" TEXT,
    "externalTradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeMapping" (
    "id" TEXT NOT NULL,
    "copierId" TEXT NOT NULL,
    "masterTradeId" TEXT NOT NULL,
    "slaveTradeId" TEXT NOT NULL,
    "slaveAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "syncedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskRule" (
    "id" TEXT NOT NULL,
    "copierConfigId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "action" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "copierId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "masterTradeId" TEXT,
    "slaveTradeId" TEXT,
    "slaveAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "TradingAccount_userId_idx" ON "TradingAccount"("userId");

-- CreateIndex
CREATE INDEX "TradingAccount_firm_idx" ON "TradingAccount"("firm");

-- CreateIndex
CREATE INDEX "TradingAccount_accountNumber_idx" ON "TradingAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "Copier_userId_idx" ON "Copier"("userId");

-- CreateIndex
CREATE INDEX "Copier_masterAccountId_idx" ON "Copier"("masterAccountId");

-- CreateIndex
CREATE INDEX "Copier_status_idx" ON "Copier"("status");

-- CreateIndex
CREATE INDEX "CopierAccountConfig_copierId_idx" ON "CopierAccountConfig"("copierId");

-- CreateIndex
CREATE INDEX "CopierAccountConfig_slaveAccountId_idx" ON "CopierAccountConfig"("slaveAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CopierAccountConfig_copierId_slaveAccountId_key" ON "CopierAccountConfig"("copierId", "slaveAccountId");

-- CreateIndex
CREATE INDEX "Trade_copierId_idx" ON "Trade"("copierId");

-- CreateIndex
CREATE INDEX "Trade_accountId_idx" ON "Trade"("accountId");

-- CreateIndex
CREATE INDEX "Trade_status_idx" ON "Trade"("status");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");

-- CreateIndex
CREATE INDEX "Trade_externalOrderId_idx" ON "Trade"("externalOrderId");

-- CreateIndex
CREATE INDEX "TradeMapping_copierId_idx" ON "TradeMapping"("copierId");

-- CreateIndex
CREATE INDEX "TradeMapping_masterTradeId_idx" ON "TradeMapping"("masterTradeId");

-- CreateIndex
CREATE INDEX "TradeMapping_slaveTradeId_idx" ON "TradeMapping"("slaveTradeId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeMapping_masterTradeId_slaveAccountId_key" ON "TradeMapping"("masterTradeId", "slaveAccountId");

-- CreateIndex
CREATE INDEX "RiskRule_copierConfigId_idx" ON "RiskRule"("copierConfigId");

-- CreateIndex
CREATE INDEX "ExecutionLog_copierId_idx" ON "ExecutionLog"("copierId");

-- CreateIndex
CREATE INDEX "ExecutionLog_level_idx" ON "ExecutionLog"("level");

-- CreateIndex
CREATE INDEX "ExecutionLog_createdAt_idx" ON "ExecutionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingAccount" ADD CONSTRAINT "TradingAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Copier" ADD CONSTRAINT "Copier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Copier" ADD CONSTRAINT "Copier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Copier" ADD CONSTRAINT "Copier_masterAccountId_fkey" FOREIGN KEY ("masterAccountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopierAccountConfig" ADD CONSTRAINT "CopierAccountConfig_copierId_fkey" FOREIGN KEY ("copierId") REFERENCES "Copier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopierAccountConfig" ADD CONSTRAINT "CopierAccountConfig_slaveAccountId_fkey" FOREIGN KEY ("slaveAccountId") REFERENCES "TradingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_copierId_fkey" FOREIGN KEY ("copierId") REFERENCES "Copier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TradingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeMapping" ADD CONSTRAINT "TradeMapping_copierId_fkey" FOREIGN KEY ("copierId") REFERENCES "Copier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_copierId_fkey" FOREIGN KEY ("copierId") REFERENCES "Copier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
