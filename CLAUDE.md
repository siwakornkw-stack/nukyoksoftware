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
npm run db:dev         # embedded Postgres on :5433 (see "Local dev on Windows")
```
Runtime needs PostgreSQL + `.env` (copy `.env.example`). Deploy: `DEPLOY.md`.

## Local dev on Windows (the project path contains Thai characters)

- `npm run db:dev` dies silently while `cpSync`-ing 107MB of Postgres binaries (exit 127, no error). Copy them with the shell first, then re-run: `cp -r node_modules/@embedded-postgres/windows-x64/native/. C:/dhevakij-pg/native/`. Create the `dhevakij` database yourself too — the script died before its step 4.
- Never leave real directories under `.next/dev/node_modules`. Turbopack replaces those paths with junctions and cannot remove a non-empty directory on Windows, so it panics and `/api/auth/login` answers 500. Fix: `rm -rf .next`.
- `npx tsx` cannot resolve `@prisma/client` from a script outside the project dir. Use `node -e` with the `pg` client, or put the script in the repo.
- `pg` returns `timestamp without time zone` shifted to local time. `SELECT "Col"::text` shows what is actually stored (dates are UTC midnight).

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
- **Per-vehicle records**: `src/lib/fleet/record-types.ts` is the one registry driving the generic form, the listing and the API. A field may be `type: "select"` + `master: "<master-key>"` (dropdown fed by master data); a type may set `tenanted: true` (API writes `TenantId`) and `defaults` (NOT NULL columns with no form field). Add a record type there rather than building another page.

## Next 16 gotchas

- Route/page `params` and `searchParams` are **Promises**: `const { id } = await params`.
- `cookies()` / `headers()` are async.
- Server pages that query prisma need `export const dynamic = "force-dynamic"` (or call `getSession()` which reads cookies → dynamic). Avoids build-time DB calls.
- Client components need `"use client"`; those using `useSearchParams` must be wrapped in `<Suspense>` (see `fleet/installments/page.tsx`).
- Do not import server-only modules (`@/lib/db`, `@/lib/auth`) into client components.

## Deploy notes

- Ubuntu VPS: `next start` behind nginx via PM2 (`ecosystem.config.js`: web + cron worker). Cron endpoints (`/api/cron/reminders`, `/api/cron/fuel-monthly`) are hit by the worker or crontab, guarded by `CRON_SECRET`.
- Host: `ubuntu@15.235.208.118`, key `~/.ssh/id_88arena_vps`. App dir is **`/home/ubuntu/dhevakij`**, not `/opt/dhevakij` — DEPLOY.md is wrong. PM2 apps: `dhevakij-web` (port 3002) and `dhevakij-cron`. The box is shared with other apps and has no passwordless sudo (so nginx config is unreadable from a session).
- The VPS has **no GitHub credentials**, so `git pull` there fails with `could not read Username for 'https://github.com'`. Ship source instead: `git archive HEAD src | ssh -i ~/.ssh/id_88arena_vps ubuntu@15.235.208.118 tar xf - -C /home/ubuntu/dhevakij`, then `npm run build && pm2 restart dhevakij-web dhevakij-cron`. `npm ci` and `prisma migrate deploy` can be skipped when `package-lock.json` and `prisma/schema.prisma` hash the same on both sides.
- Consequence: `git log` on the VPS shows an old commit even when the files are current. Confirm a deploy by hashing `src/` on both sides (strip `\r` first — the server tree still holds CRLF files), never by git.
- `.next`, `.env` and `node_modules` are deliberately **not** tracked. They were, and it broke `npm run dev` and made the repo unusable as a deploy source (a pull would have overwritten the server's real `.env`). Do not re-add them. `.gitattributes` routes `*.node`/`*.sst` through Git LFS, so committing `node_modules` again pushes hundreds of MB to LFS.
- Local filesystem storage under `UPLOAD_DIR`. Do NOT add an nginx `alias` for `/uploads` without auth (files are private).
- `JWT_ACCESS_SECRET` is **required in production** (auth throws at first sign/verify if unset).

## Known debt (audited, not yet fixed — LOW severity)

LINE webhook signature compare is not constant-time; logout is a GET side-effect; `storage.del` unused; dead `serverActions.bodySizeLimit` in `next.config.ts`; duplicated helpers (bkkMonth, debt vs fleet date-parse, aging buckets); debt `getCurrentRecords` has no pagination. `monthlyByEmployee` is a full-history rollup by design. See `ARCHITECTURE.md` / prior audit for detail.

## Working style

- Verify claims against real code before asserting (an audit once flagged a "critical" dead-middleware bug that a runtime test disproved).
- Keep changes surgical; match existing patterns. `npx tsc --noEmit` + `npm run build` are the authoritative checks (eslint 9 flat config works via `npm run lint`).
- `npm run lint` baseline is **5 warnings** (`react-hooks/set-state-in-effect`, all from the existing `useEffect(load, [load])` pattern). The bar is 0 errors; leave those 5 alone unless asked.
- To exercise a UI error branch, stub `window.fetch` in the browser to return the status you want. React-controlled inputs need the native value setter plus a dispatched `input`/`change` event — assigning `el.value` does not reach state.
