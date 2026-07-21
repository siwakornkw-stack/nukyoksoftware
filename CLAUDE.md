# CLAUDE.md

Guidance for AI agents working in this repo. Read before editing.

## What this is

**เทวาวณิชกิจ (dhevakij)** — one Next.js app merging three business modules for a single Thai company, deployed on an Ubuntu VPS (not Vercel). Thai-first UI.

| Module | Route | Purpose |
|--------|-------|---------|
| Fleet & finance | `/fleet` | Vehicles, drivers/jobs, installment AR, per-vehicle records (tax/พรบ/insurance/tires/…), reports, LINE reminders |
| Fuel bills | `/fuel` | LINE bot receives fuel receipts → Gemini OCR → fraud checks → dashboard |
| Debt / AR | `/debt` | Upload BillingNote Excel → debt dashboard, aging, records |

See `ARCHITECTURE.md` for the source→target mapping (came from three legacy apps: nukyok, โปรแกรมนำมัน, dhevadebt).

## Stack

Next.js 16.2.7 (App Router) · React 19 · Tailwind v4 (dark, **no MUI**) · Prisma 5 + PostgreSQL · TypeScript strict · recharts · xlsx · @line/bot-sdk · sharp · JWT (jsonwebtoken) + bcryptjs.

## Commands

```bash
npm run dev            # next dev
npm run build          # prisma generate && next build
npm run lint           # eslint (flat config)
npm run prisma:migrate # prisma migrate dev
npm run db:seed        # tenant + admin/admin1234
npm run worker         # node-cron worker (hits /api/cron/*)
```
Runtime needs PostgreSQL + `.env` (copy `.env.example`). Deploy: `DEPLOY.md`.

## Foundation contract (reuse these; do not reinvent)

```ts
import { prisma } from "@/lib/db";
import { DEFAULT_TENANT_ID } from "@/lib/tenant";   // scope EVERY tenant-owned query to this
import { put, get, del, publicUrl } from "@/lib/storage"; // local FS; keys "fuel/2026-07/<uuid>.jpg"
import { getSession, requireSession } from "@/lib/auth";  // JWT cookie
import { baht, num, thDate, thDateTime, STATUS_STYLE } from "@/lib/format";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { dec } from "@/lib/fleet/queries";          // Prisma Decimal -> number
import { normalizeDate, toISO } from "@/lib/fleet/dates"; // Excel serial / DD-MM / Thai BE year
```

Layout:
- Pages under `src/app/(app)/<module>/…` (inherit the sidebar shell).
- API under `src/app/api/<module>/…`.
- Module libs under `src/lib/<module>/…`.

## Conventions

- **Auth**: every API handler starts with `const s = await getSession(); if (!s) return NextResponse.json({error:"unauthorized"},{status:401});`. Public (no-auth) routes only: `/api/fuel/webhook`, `/api/cron/*`, `/login`, `/api/auth/*`. `/uploads/*` requires a session (private files).
- **Tenancy**: multi-tenant schema kept, but this is a single-company install — one seeded tenant `DEFAULT_TENANT_ID`. Always scope by it (fleet child records: `where: { Vehicle: { TenantId: DEFAULT_TENANT_ID } }`).
- **Auth gate**: `src/proxy.ts` (Next 16 proxy/middleware) redirects unauthenticated navigation to `/login`. `(app)/layout.tsx` also redirects as defense-in-depth. NOTE: the build's `middleware-manifest.json` looks empty but the proxy **does** run (verified at runtime) — don't "fix" it by renaming.
- **Money**: Prisma `Decimal` everywhere. Read with `dec(x)` / `Number(x)`; write by passing a number. Convert Decimal→number at every API/JSON boundary (Decimal serializes to a string otherwise, breaking client arithmetic).
- **Dates**: `normalizeDate` builds **UTC-midnight** Dates; the server runs `TZ=UTC` (ecosystem.config.js) so `toISOString().slice(0,10)` round-trips stably. Bangkok-specific formatting uses explicit `Intl.DateTimeFormat({ timeZone: "Asia/Bangkok" })` (see fuel cron/webhook).
- **Thai Buddhist-Era years**: handled in `normalizeDate` (4-digit `≥2400 → -543`; 2-digit `>43 → BE`, else CE).

## Next 16 gotchas

- Route/page `params` and `searchParams` are **Promises**: `const { id } = await params`.
- `cookies()` / `headers()` are async.
- Server pages that query prisma need `export const dynamic = "force-dynamic"` (or call `getSession()` which reads cookies → dynamic). Avoids build-time DB calls.
- Client components need `"use client"`; those using `useSearchParams` must be wrapped in `<Suspense>` (see `fleet/installments/page.tsx`).
- Do not import server-only modules (`@/lib/db`, `@/lib/auth`) into client components.

## Deploy notes

- Ubuntu VPS: `next start` behind nginx via PM2 (`ecosystem.config.js`: web + cron worker). Cron endpoints (`/api/cron/reminders`, `/api/cron/fuel-monthly`) are hit by the worker or crontab, guarded by `CRON_SECRET`.
- Local filesystem storage under `UPLOAD_DIR`. Do NOT add an nginx `alias` for `/uploads` without auth (files are private).
- `JWT_ACCESS_SECRET` is **required in production** (auth throws at first sign/verify if unset).

## Known debt (audited, not yet fixed — LOW severity)

LINE webhook signature compare is not constant-time; logout is a GET side-effect; `storage.del` unused; dead `serverActions.bodySizeLimit` in `next.config.ts`; duplicated helpers (bkkMonth, debt vs fleet date-parse, aging buckets); debt `getCurrentRecords` has no pagination. `monthlyByEmployee` is a full-history rollup by design. See `ARCHITECTURE.md` / prior audit for detail.

## Working style

- Verify claims against real code before asserting (an audit once flagged a "critical" dead-middleware bug that a runtime test disproved).
- Keep changes surgical; match existing patterns. `npx tsc --noEmit` + `npm run build` are the authoritative checks (eslint 9 flat config works via `npm run lint`).
