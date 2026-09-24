-- CreateTable
CREATE TABLE "AuditLog" (
    "AuditLogId" VARCHAR(36) NOT NULL,
    "TenantId" VARCHAR(36) NOT NULL,
    "Entity" VARCHAR(60) NOT NULL,
    "EntityId" VARCHAR(100) NOT NULL,
    "Action" VARCHAR(30) NOT NULL,
    "Before" JSONB,
    "After" JSONB,
    "Username" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("AuditLogId")
);

-- CreateIndex
CREATE INDEX "AuditLog_TenantId_CreatedAt_idx" ON "AuditLog"("TenantId", "CreatedAt");

-- CreateIndex
CREATE INDEX "AuditLog_Entity_EntityId_idx" ON "AuditLog"("Entity", "EntityId");
