import { PageHeader } from "@/components/ui";
import { OfficeImport } from "../../OfficeImport";

export default function InsuranceImportPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader title="นำเข้า พ.ร.บ. & ประกัน" subtitle="ไฟล์ตารางประกันรถ / พ.ร.บ. / ภาษี ของออฟฟิศ" />
      <OfficeImport
        kind="insurance"
        itemLabel="แถว"
        links={[
          { href: "/fleet/insurance", label: "ดูรายงาน พ.ร.บ. & ประกัน" },
          { href: "/fleet/insurance/records", label: "ดูรายละเอียด" },
        ]}
        format={
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>ทุกแผ่นงานที่มีหัวตาราง &quot;ป้ายทะเบียน&quot; (เช่น 6 ล้อ, รถแบคโฮ)</li>
            <li>
              คอลัมน์: ป้ายทะเบียน · ชื่อคนขับ · ประเภทรถ · ลักษณะ · ประกันหมดวันที่ · ประกันชั้น · ชื่อประกัน · พรบ. · ภาษี ·
              หมายเหตุ (ลำดับคอลัมน์สลับได้)
            </li>
            <li>1 แถวสร้างได้สูงสุด 3 รายการ: ประกันภัย, พ.ร.บ., ภาษี ตามวันหมดอายุที่กรอกไว้ แถวที่ไม่มีวันที่จะถูกข้าม</li>
            <li>นำเข้าซ้ำได้ รายการที่รถ + ประเภท + วันหมดอายุ ตรงกับที่มีอยู่จะไม่ถูกบันทึกซ้ำ (ต่ออายุแล้วนำเข้าใหม่ได้เลย)</li>
          </ul>
        }
      />
    </div>
  );
}
