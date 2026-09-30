import { PageHeader } from "@/components/ui";
import { IncomeImport } from "./IncomeImport";

export default function IncomeImportPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader title="นำเข้ารายรับ" subtitle="ไฟล์รายรับประจำเดือนของออฟฟิศ (เลือกได้หลายไฟล์พร้อมกัน)" />
      <IncomeImport />
    </div>
  );
}
