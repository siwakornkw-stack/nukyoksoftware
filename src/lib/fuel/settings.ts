import { prisma } from "@/lib/db";

const LINE_ADMIN_KEY = "line_admin_id";

// DB setting wins; env LINE_ADMIN_ID is the fallback.
export async function getLineAdminId(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: LINE_ADMIN_KEY } });
  return (row?.value ?? process.env.LINE_ADMIN_ID ?? "").trim();
}

export async function setLineAdminId(value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: LINE_ADMIN_KEY },
    update: { value },
    create: { key: LINE_ADMIN_KEY, value },
  });
}
