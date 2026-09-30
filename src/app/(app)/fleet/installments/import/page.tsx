import { PageHeader } from "@/components/ui";
import { OfficeImport } from "../../OfficeImport";

export default function InstallmentsImportPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader title="นำเข้าค่างวด" subtitle="ไฟล์ตารางทะเบียนเครื่องจักร (ค่างวดรายเดือน) ของออฟฟิศ" />
      <OfficeImport
        kind="installments"
        itemLabel="คัน"
        updateLabel="บันทึกจ่ายแล้ว"
        links={[{ href: "/fleet/installments?filter=all", label: "ดูค่างวด" }]}
        format={
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>แผ่นงานที่มีหัวตาราง &quot;รายการทรัพย์สิน&quot; และคอลัมน์เดือน (เช่น &quot;เดือน 06/69&quot;) แผ่นอื่นจะถูกข้าม</li>
            <li>คอลัมน์: รายการทรัพย์สิน · ทะเบียน · วันที่ชำระ (เช่น &quot;โอนไม่เกินวันที่ 5&quot;) · จำนวนเงิน · เดือน ../..</li>
            <li>ช่องเดือนที่มีเลขงวด (เช่น 43/48) = 1 งวด ครบกำหนดวันที่ตามคอลัมน์วันที่ชำระของเดือนนั้น</li>
            <li>ช่องที่ถมสีเขียว = จ่ายแล้ว (บันทึกวันที่จ่ายเป็นวันครบกำหนด)</li>
            <li>
              นำเข้าซ้ำได้ งวดที่มีอยู่แล้ว (รถ + เลขงวดเดียวกัน) จะไม่ถูกบันทึกซ้ำ แต่ถ้าในไฟล์ถมเขียวแล้วและในระบบยังไม่จ่าย
              จะบันทึกจ่ายให้
            </li>
          </ul>
        }
      />
    </div>
  );
}
