import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

// JSON round-trip: Decimal -> string, Date -> ISO, so rows store as plain JSON.
const plain = (v: unknown) => (v == null ? Prisma.DbNull : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));

// Record who changed what (money-related data, user accounts). Never lets a
// logging failure break the change it describes.
export async function audit(
  entity: string,
  entityId: string,
  action: string,
  username: string | null,
  before?: unknown,
  after?: unknown
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        TenantId: DEFAULT_TENANT_ID,
        Entity: entity,
        EntityId: entityId,
        Action: action,
        Username: username,
        Before: plain(before),
        After: plain(after),
      },
    });
  } catch (e) {
    console.error("audit log failed:", (e as Error)?.message);
  }
}
