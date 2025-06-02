-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "ReadingType" AS ENUM ('ACTUAL', 'ESTIMATED', 'CUSTOMER_READ');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('FLAT', 'TIERED', 'TIME_OF_USE', 'DEMAND');

-- CreateEnum
CREATE TYPE "TariffStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('DRAFT', 'CALCULATED', 'INVOICED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'ENERGY_ADMIN';
ALTER TYPE "Role" ADD VALUE 'CLIENT_ADMIN';
ALTER TYPE "Role" ADD VALUE 'CUSTOMER_USER';

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "billingAddress" TEXT,
    "billingContact" TEXT,
    "billingEmail" TEXT,
    "organizationId" INTEGER NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "customerNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "serviceAddress" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "accountNumber" TEXT,
    "meterNumber" TEXT,
    "clientId" INTEGER NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" SERIAL NOT NULL,
    "meterNumber" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "readingValue" DECIMAL(12,3) NOT NULL,
    "readingType" "ReadingType" NOT NULL DEFAULT 'ACTUAL',
    "demandReading" DECIMAL(12,3),
    "onPeakUsage" DECIMAL(12,3),
    "offPeakUsage" DECIMAL(12,3),
    "midPeakUsage" DECIMAL(12,3),
    "customerId" INTEGER NOT NULL,
    "billingPeriodId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_rates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "rateType" "RateType" NOT NULL DEFAULT 'FLAT',
    "energyRate" DECIMAL(8,5) NOT NULL,
    "onPeakRate" DECIMAL(8,5),
    "offPeakRate" DECIMAL(8,5),
    "midPeakRate" DECIMAL(8,5),
    "demandRate" DECIMAL(8,2),
    "monthlyCharge" DECIMAL(8,2),
    "connectionFee" DECIMAL(8,2),
    "clientId" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "TariffStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariff_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_blocks" (
    "id" SERIAL NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "fromKwh" DECIMAL(12,3) NOT NULL,
    "toKwh" DECIMAL(12,3),
    "rate" DECIMAL(8,5) NOT NULL,
    "tariffRateId" INTEGER NOT NULL,

    CONSTRAINT "tariff_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_periods" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalKwh" DECIMAL(12,3),
    "totalAmount" DECIMAL(10,2),
    "customerId" INTEGER NOT NULL,
    "tariffRateId" INTEGER,
    "status" "BillingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "energyCharges" DECIMAL(10,2) NOT NULL,
    "demandCharges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "adjustments" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "totalKwh" DECIMAL(12,3) NOT NULL,
    "peakDemand" DECIMAL(12,3),
    "billingDays" INTEGER NOT NULL,
    "averageDailyUsage" DECIMAL(12,3),
    "customerId" INTEGER NOT NULL,
    "billingPeriodId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "pdfUrl" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "paidDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_code_key" ON "clients"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customers_clientId_customerNumber_key" ON "customers"("clientId", "customerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "meter_readings_customerId_meterNumber_readingDate_key" ON "meter_readings"("customerId", "meterNumber", "readingDate");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_rates_clientId_code_key" ON "tariff_rates"("clientId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_blocks_tariffRateId_blockNumber_key" ON "tariff_blocks"("tariffRateId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "billing_periods_customerId_startDate_key" ON "billing_periods"("customerId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_billingPeriodId_key" ON "invoices"("billingPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_clientId_invoiceNumber_key" ON "invoices"("clientId", "invoiceNumber");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "billing_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_rates" ADD CONSTRAINT "tariff_rates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_blocks" ADD CONSTRAINT "tariff_blocks_tariffRateId_fkey" FOREIGN KEY ("tariffRateId") REFERENCES "tariff_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_tariffRateId_fkey" FOREIGN KEY ("tariffRateId") REFERENCES "tariff_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "billing_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
