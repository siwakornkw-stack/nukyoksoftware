import { PoList, type SP } from "../PoList";

export const dynamic = "force-dynamic";

// ใบสั่งซื้อ-น้ำมัน(ใหม่): Express book with the PK prefix. A static segment, so
// it wins over /po/[poNo] (no PO number is "pk").
export default async function PkPurchaseOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <PoList sp={await searchParams} book="pk" />;
}
