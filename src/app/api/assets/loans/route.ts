import { NextResponse } from "next/server";
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

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const loans = await prisma.assetLoan.findMany({
    where: { Asset: { TenantId: DEFAULT_TENANT_ID } },
    include: { Asset: { select: { Name: true, Category: true } } },
    orderBy: { BorrowedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ loans });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === "borrow") {
    if (!b.assetId) return NextResponse.json({ error: "ต้องระบุสินทรัพย์" }, { status: 400 });
    if (!b.borrowerName) return NextResponse.json({ error: "ต้องระบุชื่อผู้ยืม" }, { status: 400 });
    if (!b.location) return NextResponse.json({ error: "ต้องระบุสถานที่นำไปใช้" }, { status: 400 });
    const asset = await prisma.asset.findFirst({
      where: { AssetId: b.assetId, TenantId: DEFAULT_TENANT_ID },
      include: { Loans: { where: { ReturnedAt: null }, take: 1 } },
    });
    if (!asset) return NextResponse.json({ error: "ไม่พบสินทรัพย์นี้" }, { status: 404 });
    if (asset.Loans.length) return NextResponse.json({ error: "สินทรัพย์นี้ถูกยืมอยู่" }, { status: 400 });
    const loan = await prisma.assetLoan.create({
      data: {
        AssetId: b.assetId,
        BorrowerName: b.borrowerName,
        Location: b.location,
        Note: b.note || null,
        CreatedByUsername: session.username,
      },
    });
    return NextResponse.json({ loan });
  }

  if (b.action === "return") {
    if (!b.assetLoanId) return NextResponse.json({ error: "ไม่พบรายการยืมที่จะคืน" }, { status: 400 });
    if (!(await ownsLoan(b.assetLoanId))) {
      return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
    }
    await prisma.assetLoan.update({
      where: { AssetLoanId: b.assetLoanId },
      data: { ReturnedAt: new Date(), UpdatedByUsername: session.username },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
