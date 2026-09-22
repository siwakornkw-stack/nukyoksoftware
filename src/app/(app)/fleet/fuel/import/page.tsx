import { PageHeader } from "@/components/ui";
import { OfficeImport } from "../../OfficeImport";

export default function FuelImportPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader title="นำเข้าค่าน้ำมัน" subtitle="ไฟล์ค่าน้ำมันประจำเดือนของออฟฟิศ (1 แผ่นงาน = รถ/เครื่องจักร 1 คัน)" />
      <OfficeImport
        kind="fuel"
        itemLabel="แผ่นงาน"
        links={[
          { href: "/fleet/fuel", label: "ดูรายงานน้ำมัน" },
          { href: "/fleet/fuel/records", label: "ดูรายละเอียด" },
        ]}
        format={
          <ul className="list-disc pl-5 space-y-1 text-slate-400">
            <li>
              ชื่อแผ่นงาน = ทะเบียน/รุ่นรถ และคนขับในวงเล็บ เช่น <span className="text-slate-200">81-0664(กิ้ม)</span>,{" "}
              <span className="text-slate-200">SK140(ก๊อต)</span>, <span className="text-slate-200">ปั่นไฟ-สีแดง</span>
            </li>
            <li>
              หัวตาราง: วัน / เดือน / ปี · รายการ · เลขที่ใบกำกับภาษี · เลขไมล์ (ต้นทาง/ปลายทาง) · ระยะทาง · จำนวนเงิน ·
              จำนวนรับ (ลิตร) · ผู้รับน้ำมัน
            </li>
            <li>วันที่แบบ พ.ศ. (5/5/2569) ได้ แผ่นงานที่ไม่มีรายการจะถูกข้าม แถวสรุปยอด/ลายเซ็นไม่ถูกนำเข้า</li>
            <li>นำเข้าไฟล์เดิมซ้ำได้ รายการที่มีอยู่แล้ว (วันที่ + เลขใบกำกับ + ยอดเงิน ตรงกัน) จะไม่ถูกบันทึกซ้ำ</li>
          </ul>
        }
      />
    </div>
  );
}
