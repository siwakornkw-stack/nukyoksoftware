-- AlterTable
ALTER TABLE "DebtRecord" ADD COLUMN "paid" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "paidAt" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "slipUrl" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtFollowUp" (
    "id" TEXT NOT NULL,
    "docNo" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "promiseDate" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebtPayment_recordId_idx" ON "DebtPayment"("recordId");

-- CreateIndex
CREATE INDEX "DebtFollowUp_docNo_idx" ON "DebtFollowUp"("docNo");

-- CreateIndex
CREATE INDEX "DebtFollowUp_promiseDate_idx" ON "DebtFollowUp"("promiseDate");

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "DebtRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
