# เทวาวณิชกิจ (dhevakij)

ระบบบริหารจัดการรวม 3 โมดูลในโปรแกรมเดียว (Next.js + PostgreSQL, deploy บน VPS Ubuntu).

รวมมาจาก 3 โปรเจคเดิม:

| โมดูล | เส้นทาง | มาจาก |
|-------|---------|-------|
| กองรถ & การเงิน | `/fleet` | nukyok (vehicle management) |
| ตรวจบิลน้ำมัน | `/fuel` | โปรแกรมนำมัน (fuel-bill-checker) |
| หนี้ / วางบิล | `/debt` | dhevadebt |

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind CSS v4
- Prisma + PostgreSQL (ฐานข้อมูลเดียว)
- Auth: JWT (httpOnly cookie) + bcrypt
- Storage: local filesystem (`UPLOAD_DIR`) เสิร์ฟผ่าน `/uploads/*`
- LINE Messaging API + Google Gemini (OCR บิลน้ำมัน)
- Cron: node-cron worker / crontab -> `/api/cron/*`

## Dev quickstart

```bash
cp .env.example .env       # ตั้ง DATABASE_URL อย่างน้อย
npm install
npx prisma migrate dev --name init
npm run db:seed            # สร้าง tenant + admin/admin1234
npm run dev                # http://localhost:3000  (login: admin / admin1234)
```

ดู `ARCHITECTURE.md` สำหรับ mapping ของโค้ดเดิม -> ใหม่ และสถานะแต่ละโมดูล.
ดู `DEPLOY.md` สำหรับการติดตั้งบน VPS.
