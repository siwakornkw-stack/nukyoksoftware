import { PageHeader } from "@/components/ui";
import { ImportTabs } from "../ImportTabs";
import { BillImport } from "./BillImport";

export default function FuelBillImportPage() {
  return (
    <div className="max-w-6xl">
      <PageHeader title="นำเข้าค่าน้ำมัน" subtitle="จากรูปถ่ายบิล/ใบกำกับภาษีน้ำมัน ระบบอ่านให้ แล้วตรวจแก้ก่อนบันทึก" />
      <ImportTabs active="/fleet/fuel/import/bills" />
      <BillImport />
    </div>
  );
}
