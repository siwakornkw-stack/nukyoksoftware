-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "Key" VARCHAR(200);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_CustomerId_Key_key" ON "Notification"("CustomerId", "Key");
