import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Loans are addressed by their own id, so without this the tenant scope that
// guards every other query here would be missing on the return action.
async function ownsLoan(assetLoanId: string): Promise<boolean> {
  const loan = await prisma.assetLoan.findUnique({
    where: { AssetLoanId: assetLoanId },
    select: { Asset: { select: { TenantId: true } } },
  });
  return loan?.Asset.TenantId === DEFAULT_TENANT_ID;
}

export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // ?assetId= narrows to one asset's full history.
  const assetId = new URL(req.url).searchParams.get("assetId");
  const loans = await prisma.assetLoan.findMany({
    where: { Asset: { TenantId: DEFAULT_TENANT_ID }, ...(assetId ? { AssetId: assetId } : {}) },
    include: { Asset: { select: { Name: true, Category: true } } },
    orderBy: { BorrowedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ loans });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (b.action === "borrow") {
    const assetId = str(b.assetId);
    const borrowerName = str(b.borrowerName);
    const location = str(b.location);
    if (!assetId) return NextResponse.json({ error: "ต้องระบุสินทรัพย์" }, { status: 400 });
    if (!borrowerName) return NextResponse.json({ error: "ต้องระบุชื่อผู้ยืม" }, { status: 400 });
    if (!location) return NextResponse.json({ error: "ต้องระบุสถานที่นำไปใช้" }, { status: 400 });
    const asset = await prisma.asset.findFirst({
      where: { AssetId: assetId, TenantId: DEFAULT_TENANT_ID },
      include: { Loans: { where: { ReturnedAt: null }, take: 1 } },
    });
    if (!asset) return NextResponse.json({ error: "ไม่พบสินทรัพย์นี้" }, { status: 404 });
    if (asset.Inactive) return NextResponse.json({ error: "สินทรัพย์นี้ปลดระวางแล้ว" }, { status: 400 });
    if (asset.Loans.length) return NextResponse.json({ error: "สินทรัพย์นี้ถูกยืมอยู่" }, { status: 400 });
    // Optional expected return date (YYYY-MM-DD, stored as UTC midnight like other dates).
    const due = str(b.dueAt);
    const DueAt = due ? new Date(`${due}T00:00:00.000Z`) : null;
    if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || isNaN(DueAt!.getTime()))) {
      return NextResponse.json({ error: "วันที่กำหนดคืนไม่ถูกต้อง" }, { status: 400 });
    }
    try {
      const loan = await prisma.assetLoan.create({
        data: {
          AssetId: assetId,
          BorrowerName: borrowerName,
          Location: location,
          DueAt,
          Note: str(b.note) || null,
          CreatedByUsername: session.username,
        },
      });
      return NextResponse.json({ loan });
    } catch (e) {
      // A concurrent borrow won the race: the partial unique index
      // "AssetLoan_AssetId_open_key" allows one open loan per asset.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "สินทรัพย์นี้ถูกยืมอยู่" }, { status: 400 });
      }
      throw e;
    }
  }

  if (b.action === "return") {
    const assetLoanId = str(b.assetLoanId);
    if (!assetLoanId) return NextResponse.json({ error: "ไม่พบรายการยืมที่จะคืน" }, { status: 400 });
    if (!(await ownsLoan(assetLoanId))) {
      return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
    }
    // Only an open loan: a second click must not move the return date.
    const { count } = await prisma.assetLoan.updateMany({
      where: { AssetLoanId: assetLoanId, ReturnedAt: null },
      data: { ReturnedAt: new Date(), UpdatedByUsername: session.username },
    });
    if (!count) return NextResponse.json({ error: "รายการนี้คืนแล้ว" }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
