-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "TotpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "TotpSecret" VARCHAR(64);
