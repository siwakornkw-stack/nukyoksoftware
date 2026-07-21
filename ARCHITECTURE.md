# Architecture — merge of 3 projects into one app

Target: **one Next.js 16 app**, **one PostgreSQL (Prisma)**, **local filesystem storage**, deploy to **Ubuntu VPS**. Fresh start (no data migration from the old apps).

## Source → target mapping

| Old project | Old stack | New location | Data |
|-------------|-----------|--------------|------|
| **nukyok** (vehicle mgmt) | Next 14 + MUI + Express 4 + Prisma/PG + Redis + Vercel Cron | `/fleet` pages + `/api/fleet/*` + `/api/cron/reminders`, lib `src/lib/fleet/*` | Prisma models `Tenant, Vehicle, Installments…` (schema kept) |
| **โปรแกรมนำมัน** (fuel bills) | Express 5 ESM + Neon raw SQL + Gemini + Vercel Blob | `/fuel` pages + `/api/fuel/*` (webhook) + `/api/cron/fuel-monthly`, lib `src/lib/fuel/*` | Prisma `FuelBill`, `AppSetting` |
| **dhevadebt** (debt/AR) | Next 16 + Tailwind v4 + Vercel Blob | `/debt` pages + `/api/debt/*`, lib `src/lib/debt/*` | Prisma `DebtVersion`, `DebtRecord` |

The base shell (Next 16 + Tailwind v4) is dhevadebt's; the DB schema base is nukyok's.

## What changed vs the originals

- **Vercel Blob → local FS.** `src/lib/storage.ts` (`put/get/del/publicUrl`), served by `src/app/uploads/[...path]/route.ts` (or nginx). Debt no longer uses blob at all (moved to DB rows).
- **Neon raw SQL → Prisma.** Fuel `bills`/`settings` became `FuelBill`/`AppSetting`.
- **Vercel Cron / serverless → VPS.** Cron endpoints under `/api/cron/*` guarded by `CRON_SECRET`, triggered by `worker/cron.mjs` (node-cron) or the system crontab.
- **Three auth systems → one.** JWT httpOnly cookie (`src/lib/auth.ts`) + `src/proxy.ts` (Next 16 proxy/middleware). Fuel's HTTP Basic dashboard is gone; the fuel dashboard is a normal page behind login.
- **Multi-tenant kept, single tenant seeded.** `DEFAULT_TENANT_ID` (`src/lib/tenant.ts`); every fleet query scopes to it.

## Foundation contract (for module code)

- Prisma client: `import { prisma } from "@/lib/db"`
- Tenant scope: `import { DEFAULT_TENANT_ID } from "@/lib/tenant"`
- Storage: `import { put, get, del, publicUrl } from "@/lib/storage"` (keys like `fuel/2026-07/<uuid>.jpg`)
- Auth/session: `import { getSession, requireSession } from "@/lib/auth"`
- Format helpers: `import { baht, num, thDate, thDateTime, STATUS_STYLE } from "@/lib/format"`
- UI primitives: `import { PageHeader, Card, StatCard } from "@/components/ui"`
- Pages live under the `(app)` route group so they get the sidebar shell: `src/app/(app)/<module>/…`
- API routes: `src/app/api/<module>/…` — remember Next 16: `params` is a `Promise`, `cookies()` is async.
- Public (no-auth) routes are `/api/fuel/webhook`, `/api/cron/*`, `/uploads/*`, `/login`, `/api/auth/*` (see `src/proxy.ts`).

## Module status

- **Foundation** — done: schema, auth+login, shell/nav, storage, cron plumbing, deploy files.
- **/debt** — ported from dhevadebt (blob → Prisma).
- **/fuel** — ported from fuel-bill-checker (Express → route handlers, Neon → Prisma, vanilla dashboard → React).
- **/fleet** — core ported from nukyok (dashboard, vehicles, installments/AR, drivers, import, reports, LINE reminders). The long tail of per-vehicle sub-record screens (tax/พรบ/insurance/tires/accident/repair/oil) follows the same CRUD pattern and can be added incrementally.

## Extending

Add a per-vehicle record type: add pages under `src/app/(app)/fleet/vehicles/[id]/<record>`, an API route under `src/app/api/fleet/<record>`, reuse the existing Prisma child models. No schema change needed — they already exist.
