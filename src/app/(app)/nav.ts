// Shared by the sidebar (client) and the home page menu (server). Kept out of
// Sidebar.tsx: a server component cannot read plain values from a "use client" module.
export type NavItem = { href: string; label: string; icon: string; adminOnly?: boolean };
export type NavGroup = { title: string | null; icon?: string; items: NavItem[] };

export const groups: NavGroup[] = [
  {
    title: null,
    items: [
      { href: "/", label: "ภาพรวม", icon: "🏠" },
      { href: "/notifications", label: "การแจ้งเตือน", icon: "🔔" },
      { href: "/help", label: "วิธีใช้งาน", icon: "📖" },
    ],
  },
  {
    title: "กองรถ & การเงิน",
    icon: "🚚",
    items: [
      { href: "/fleet", label: "แดชบอร์ด", icon: "📊" },
      { href: "/fleet/vehicles", label: "ทะเบียนรถ", icon: "🚚" },
      { href: "/fleet/drivers", label: "คนขับ & งานวิ่ง", icon: "🧑‍✈️" },
      { href: "/fleet/drivers/summary", label: "สรุปงานคนขับ", icon: "🧮" },
      { href: "/fleet/maintenance", label: "บำรุงรักษา (เลขไมล์)", icon: "🔧" },
      { href: "/fleet/installments", label: "ค่างวดรถ", icon: "💳" },
      { href: "/fleet/import", label: "นำเข้าข้อมูล", icon: "⬆️" },
      { href: "/fleet/reports", label: "รายงาน", icon: "📈" },
      { href: "/fleet/reports/vehicles", label: "กำไร/ต้นทุนรายคัน", icon: "⚖️" },
      { href: "/fleet/budget", label: "งบรายเดือนต่อคัน", icon: "🎯" },
      { href: "/fleet/master", label: "ข้อมูลหลัก", icon: "🗂️" },
    ],
  },
  {
    title: "น้ำมัน",
    icon: "🛢️",
    items: [
      { href: "/fleet/fuel", label: "รายงานน้ำมัน", icon: "📈" },
      { href: "/fleet/fuel/records", label: "รายละเอียดน้ำมัน", icon: "🛢️" },
      { href: "/fleet/fuel/import", label: "นำเข้าค่าน้ำมัน", icon: "⬆️" },
    ],
  },
  {
    title: "พ.ร.บ. & ประกัน",
    icon: "🛡️",
    items: [
      { href: "/fleet/insurance", label: "รายงาน พ.ร.บ./ประกัน", icon: "🛡️" },
      { href: "/fleet/insurance/records", label: "รายละเอียด", icon: "📄" },
      { href: "/fleet/insurance/import", label: "นำเข้าตารางประกัน", icon: "⬆️" },
    ],
  },
  {
    title: "บิลน้ำมัน",
    icon: "⛽",
    items: [
      { href: "/fuel", label: "ตรวจบิลน้ำมัน", icon: "⛽" },
      { href: "/fuel/reconcile", label: "เทียบกับบัญชีออฟฟิศ", icon: "🔍" },
    ],
  },
  {
    title: "สินทรัพย์",
    icon: "📦",
    items: [{ href: "/assets", label: "ยืม-คืนสินทรัพย์", icon: "📦" }],
  },
  {
    title: "หนี้ / วางบิล",
    icon: "🧾",
    items: [
      { href: "/debt", label: "แดชบอร์ดหนี้", icon: "🧾" },
      { href: "/debt/records", label: "รายการหนี้", icon: "📋" },
      { href: "/debt/upload", label: "อัปโหลด Excel", icon: "⬆️" },
    ],
  },
  {
    title: "ตั้งค่า",
    icon: "⚙️",
    items: [
      { href: "/account", label: "บัญชีของฉัน", icon: "🔑" },
      { href: "/settings/users", label: "ผู้ใช้งาน", icon: "👥", adminOnly: true },
      { href: "/settings/audit", label: "ประวัติการแก้ไข", icon: "🕘", adminOnly: true },
    ],
  },
];
