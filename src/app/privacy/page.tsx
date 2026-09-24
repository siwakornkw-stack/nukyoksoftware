import type { Metadata } from "next";

// Public (no login): Google requires a privacy policy URL to publish the OAuth
// app ("dhevakij backup") that stores the company's database backups in Drive.
export const metadata: Metadata = { title: "นโยบายความเป็นส่วนตัว | เทวาวณิชกิจ" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-7 text-slate-300">
      <h1 className="mb-1 text-xl font-semibold text-white">นโยบายความเป็นส่วนตัว</h1>
      <p className="mb-6 text-slate-500">ระบบบริหารจัดการ เทวาวณิชกิจ · ปรับปรุงล่าสุด 24 กันยายน 2569</p>

      <h2 className="mt-6 mb-2 font-medium text-white">ระบบนี้คืออะไร</h2>
      <p>
        ระบบนี้เป็นโปรแกรมภายในของบริษัท ใช้ได้เฉพาะพนักงานที่ได้รับบัญชีผู้ใช้ ไม่เปิดให้บุคคลภายนอกสมัครใช้งาน
      </p>

      <h2 className="mt-6 mb-2 font-medium text-white">การเชื่อมต่อ Google Drive</h2>
      <p>
        แอป &quot;dhevakij backup&quot; ขอสิทธิ์ Google Drive แบบ <code>drive.file</code> ซึ่งเข้าถึงได้เฉพาะไฟล์ที่แอปสร้างขึ้นเองเท่านั้น
        ไม่สามารถอ่าน แก้ไข หรือลบไฟล์อื่นใน Google Drive ของบัญชีนั้นได้
      </p>
      <ul className="mt-2 list-disc pl-6">
        <li>ใช้เพื่อเก็บสำเนาสำรองฐานข้อมูลของบริษัทไว้ใน Google Drive ของบริษัทเองเท่านั้น</li>
        <li>ไฟล์สำรองถูกเข้ารหัสก่อนอัปโหลด และเก็บไว้ไม่เกิน 90 วัน</li>
        <li>ไม่มีการเปิดเผย ขาย หรือส่งต่อข้อมูลที่ได้จาก Google ให้บุคคลอื่น และไม่ใช้เพื่อการโฆษณา</li>
        <li>
          การใช้ข้อมูลที่ได้จาก Google API เป็นไปตาม{" "}
          <a className="text-sky-400 underline" href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>{" "}
          รวมถึงข้อกำหนด Limited Use
        </li>
        <li>
          ยกเลิกสิทธิ์ได้ทุกเมื่อที่{" "}
          <a className="text-sky-400 underline" href="https://myaccount.google.com/permissions">
            myaccount.google.com/permissions
          </a>
        </li>
      </ul>

      <h2 className="mt-6 mb-2 font-medium text-white">ติดต่อ</h2>
      <p>สอบถามเรื่องข้อมูลส่วนบุคคล: devseoez@gmail.com</p>
    </main>
  );
}
