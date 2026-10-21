import { PoList, type SP } from "./PoList";

export const dynamic = "force-dynamic";

// ใบสั่งซื้อ (PO) and ใบสั่งซื้อ-น้ำมัน (PP); PK has its own page (/po/pk).
export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <PoList sp={await searchParams} book="main" />;
}
