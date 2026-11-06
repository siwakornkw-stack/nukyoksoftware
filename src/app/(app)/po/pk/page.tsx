import { PoList, type SP } from "../PoList";
import { BillImport } from "../../fleet/fuel/import/bills/BillImport";

export const dynamic = "force-dynamic";

// ใบสั่งซื้อ-น้ำมัน(ใหม่): Express book with the PK prefix. A static segment, so
// it wins over /po/[poNo] (no PO number is "pk"). Fuel bills are uploaded here
// too: saving one with "สั่งเปิด PK" has the office PC open its PK.
export default async function PkPurchaseOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <PoList sp={await searchParams} book="pk" top={<BillImport variant="pk" />} />;
}
