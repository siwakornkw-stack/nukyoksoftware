-- One-by-one check of fuel rows (/fleet/fuel/audit).
ALTER TABLE "GasolineCost" ADD COLUMN "AuditStatus" VARCHAR(10);
ALTER TABLE "GasolineCost" ADD COLUMN "AuditNote" TEXT;
ALTER TABLE "GasolineCost" ADD COLUMN "AuditedBy" TEXT;
ALTER TABLE "GasolineCost" ADD COLUMN "AuditedAt" TIMESTAMP(3);
