import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Single-company install: one fixed tenant that every module scopes to.
export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ADMIN_CUSTOMER_ID = "00000000-0000-0000-0000-000000000002";

async function main() {
  await prisma.tenant.upsert({
    where: { TenantId: DEFAULT_TENANT_ID },
    update: { Name: "เทวาวณิชกิจ", Status: "active" },
    create: {
      TenantId: DEFAULT_TENANT_ID,
      Name: "เทวาวณิชกิจ",
      Status: "active",
      SystemExpiredDate: new Date("2999-12-31T00:00:00Z"),
    },
  });

  const passwordHash = await bcrypt.hash("admin1234", 10);
  await prisma.customer.upsert({
    where: { CustomerId: ADMIN_CUSTOMER_ID },
    update: { PasswordHash: passwordHash, Status: "active", Role: "admin" },
    create: {
      CustomerId: ADMIN_CUSTOMER_ID,
      TenantId: DEFAULT_TENANT_ID,
      Status: "active",
      Role: "admin",
      Name: "ผู้ดูแลระบบ",
      Username: "admin",
      Password: "",
      PasswordHash: passwordHash,
      MobileNo: "0000000000",
      LatestIpAddress: "127.0.0.1",
    },
  });

  console.log("Seed complete. Login: admin / admin1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
