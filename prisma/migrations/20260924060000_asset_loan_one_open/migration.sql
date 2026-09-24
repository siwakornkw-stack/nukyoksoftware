-- At most one open (not yet returned) loan per asset. Prisma's schema cannot
-- express a partial index, so it lives only here.
CREATE UNIQUE INDEX "AssetLoan_AssetId_open_key" ON "AssetLoan"("AssetId") WHERE "ReturnedAt" IS NULL;
