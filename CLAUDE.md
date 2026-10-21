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

Next.js 16.3.6 (App Router; upgraded from 16.2.7 for the /_next/image RCE advisory) · React 19 · Tailwind v4 (dark, **no MUI**) · Prisma 5 + PostgreSQL · TypeScript strict · recharts · xlsx · @line/bot-sdk · sharp · JWT (jsonwebtoken) + bcryptjs.

## Commands

```bash
npm run dev            # next dev
npm run build          # prisma generate && next build
npm run lint           # eslint (flat config)
npm test               # vitest (tests/*.test.ts; pure logic, no DB). CI runs tsc/lint/test/build on push (.github/workflows/ci.yml)
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
import { getSession, requireSession, isAdmin } from "@/lib/auth";  // JWT cookie; session re-reads role/status from DB
import { audit } from "@/lib/audit";                 // before/after log of money data + user accounts
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
- **Roles**: `admin` | `staff` (`Customer.Role`, managed at `/settings/users`). Staff may delete per-vehicle records (the audit row keeps the full record). Admin only: deletes (vehicles, vehicle files, master data, debt payments/follow-ups), restoring deleted per-vehicle records (`/settings/trash`, `/api/trash`: re-creates the row from the delete audit's `Before` snapshot, same id), debt version switch, LINE admin settings, users, audit log. Guard with `if (!isAdmin(s)) return …403`. `getSession` re-reads the user each request, so deactivation/role changes apply immediately, and the token carries `pv` (`passwordVersion` of the bcrypt hash): any password change or admin reset ends all other sessions of that user. `/api/account/password` re-issues the caller cookie.
- **Request bodies**: read with `(await req.json().catch(() => null)) ?? {}`; a literal `null` body otherwise crashes the handler (500).
- **Untrusted JSON**: coerce to string before it reaches a Prisma `where` (`typeof v === "string" ? v.trim() : ""`). An object like `{ not: "" }` otherwise acts as a filter (was exploitable on login and debt status).
- **Races**: "check then create" needs a DB constraint behind it (one open loan per asset: partial unique index in SQL only; one row per installment number: `@@unique`). Catch `P2002` and answer 400.
- **Notifications**: one row per (user, `Key`) — e.g. `tax|<TaxId>`, `loan|<id>`, `job|<id>`; upsert so a repeat reminder refreshes the row and marks it unread. The cron writes them for every active user.
- **Login throttle** (`src/lib/rate-limit.ts`, in memory, fine while PM2 runs one web process): 5 failures per (IP, username), 20 per username, 20 per IP (only when the IP is known) in 15 minutes lock for 15 minutes. IP = `X-Real-IP`, else the last `X-Forwarded-For` hop; never the first hop (client-controlled). Verified on production 2026-09-24: nginx passes the real client IP (requests through the domain and from localhost count separately), and a spoofed `X-Forwarded-For` does not escape the limit.
- **LINE bot commands**: `id` answers anyone (needed to link drivers); `รายงาน` answers only the LINE admin ids from fuel settings; `รับ/เสร็จ <jobNo>` only the driver the job is assigned to; `งาน` lists that driver's open jobs.
- **Ops alerts**: `opsAlert(key, title, text)` (`src/lib/ops-alert.ts`) pushes to the LINE admins + admin inbox, once per 30 min per key. Sources: `instrumentation.ts` onRequestError (any unhandled 500), `/api/cron/ops` (backup script reports every run, cron worker reports failed calls), a stale/failed backup in the 08:00 `/api/cron/daily-summary`. `src/lib/today.ts` is the single source for "what needs attention" (home page + morning summary).
- **2FA**: TOTP (`src/lib/totp.ts`, RFC 6238). When `REQUIRE_ADMIN_MFA` (`src/lib/auth.ts`; **false since 2026-09-26** at the owner's request) admins without it are redirected to `/account` (layout redirect via the proxy `x-pathname` header + `MfaGuard` for client navigation); APIs are not gated. Admins reset another user from `/settings/users`. **Only admin locked out** (lost phone): on the server `psql "$URL" -c "UPDATE \"Customer\" SET \"TotpEnabled\"=false, \"TotpSecret\"=NULL WHERE \"Username\"='admin'"`.
- **Driver jobs**: closing a job (office button or LINE "เสร็จ n") goes through `completeJob()` (`src/lib/fleet/driver-jobs.ts`), which writes the fare as `IncomeVehicle` (unique `DriverJobId`). Finished jobs of one `CustomerName` go on a `DriverBill` (`src/lib/fleet/driver-bills.ts`, no VAT, printed at `/print/bills/<no>` outside the sidebar layout; letterhead in AppSetting `company_profile`). A job cannot be created/assigned on a vehicle at the garage (`src/lib/fleet/repair.ts`: RepairDate <= today < ReceiveDate).
- **Oil by meter**: `/fleet/maintenance`, `src/lib/fleet/maintenance.ts`. Meters are km for trucks and engine hours for machinery, hence `Vehicle.OilInterval` per vehicle (null = AppSetting `oil_interval_km`, default 10,000). Tires: newest change per (vehicle, position), due by age or distance whichever first (`tire_interval_months`/`tire_interval_km`, 24/50,000). `Vehicle.MonthlyBudget` vs this month's fuel + company-paid repairs: `/fleet/budget`.
- **Debt payments**: `DebtPayment` rows belong to one uploaded version (the Excel file wins: a new upload starts at 0); `DebtRecord.paid` is their sum and every debt total (summary, home, reminders, exports) uses `total - paid`. `DebtFollowUp` is keyed by `docNo` so it survives uploads; a passed `promiseDate` with a balance raises a daily reminder.
- **Reminders** (`/api/cron/reminders`): `once: true` inserts a notification but never marks it unread again (used for per-month keys: budget 80/100%, km/L drop). The worker also calls `/api/cron/monthly-summary` on the 1st at 08:30 Bangkok.
- **Uploads**: request bodies through the proxy are capped at 10 MB (`proxyClientMaxBodySize`); check `content-length` and guard `req.formData().catch(() => null)`.
- **Audit**: call `audit(entity, id, action, username, before, after)` after money-related or account changes. It never throws.
- **Tenancy**: multi-tenant schema kept, but this is a single-company install — one seeded tenant `DEFAULT_TENANT_ID`. Always scope by it (fleet child records: `where: { Vehicle: { TenantId: DEFAULT_TENANT_ID } }`).
- **Auth gate**: `src/proxy.ts` (Next 16 proxy/middleware) redirects unauthenticated navigation to `/login`. `(app)/layout.tsx` also redirects as defense-in-depth. NOTE: the build's `middleware-manifest.json` looks empty but the proxy **does** run (verified at runtime) — don't "fix" it by renaming.
- **Money**: Prisma `Decimal` everywhere. Read with `dec(x)` / `Number(x)`; write by passing a number. Convert Decimal→number at every API/JSON boundary (Decimal serializes to a string otherwise, breaking client arithmetic).
- **Dates**: `normalizeDate` builds **UTC-midnight** Dates; the server runs `TZ=UTC` (ecosystem.config.js) so `toISOString().slice(0,10)` round-trips stably. Bangkok-specific formatting uses explicit `Intl.DateTimeFormat({ timeZone: "Asia/Bangkok" })` (see fuel cron/webhook).
- **Thai Buddhist-Era years**: handled in `normalizeDate` (4-digit `≥2400 → -543`; 2-digit `>43 → BE`, else CE; Excel serials whose year is ≥2400, i.e. "5/5/2569" typed into Excel, also get `-543`).
- **Office Excel imports** (`/fleet/fuel/import`, `/fleet/insurance/import`, `src/lib/fleet/office-import.ts`): preview first, then commit. Rows dedupe on `ImportKey`, fixed at import time (fuel: `vehicleId|date|invoice|amount`; insurance: `kind|vehicleId|endDate`, plus the current vehicle+kind+expiry), so web edits don't cause duplicates on re-import. Existing rows are skipped, except that an insurance row's note from the file is applied to the stored records (`ใหม่ (เดิม: เก่า)` when there was an old note; an empty note in the file changes nothing).
- **Fuel bill photos** (`/fleet/fuel/import/bills`, `src/lib/fleet/fuel-bills.ts`, `/api/fleet/fuel-bills`): each photo is read by the same Gemini reader as the LINE fuel bot (`src/lib/fuel/extract.ts`), the user checks/edits every row, then rows are saved as `GasolineCost` with the Excel import's `fuelKey` as `ImportKey` (so the month's Excel file skips them). Duplicate = same `ImportKey` or same `TaxInvoiceNumber` + `Amount`. The photo is stored at upload (`fuel-bills/YYYY-MM/<uuid>.jpg`, full size, about 300 KB) before the reader runs, so when the reader fails (free tier: 2.5-flash allows 20 requests a day; rejected key fires `opsAlert("gemini-key")`) the bill is typed by hand and still saved with its photo in `GasolineCost.BillUrl`. Start mileage is filled in from the latest earlier fill of the vehicle (its end, or its start when the end is 0, which is how staff record it), including earlier bills in the same batch.
- **Fuel audit** (`/fleet/fuel/audit`, menu "ตรวจทานค่าน้ำมัน"; not the LINE-bot `/fuel` "ตรวจบิลน้ำมัน"): one fuel row at a time beside its bill photo, with the fuel records page's anomaly flags; "ถูกต้อง" / "มีปัญหา" (note required) via `POST /api/fleet/fuel-audit` sets `GasolineCost.AuditStatus` (`ok` | `problem` | null), `AuditNote`, `AuditedBy`, `AuditedAt` and writes an `audit` log row. Any edit through `PATCH /api/fleet/records/gasoline/[id]` clears the check (it was of the old values). `FuelFilters` takes `extra` params so the form keeps the page's own filters.
- **Purchase orders** (`/po`, `/print/po/<no>`, `src/lib/po/purchase-orders.ts`): copied from **Express Accounting, which must never be written to**. `scripts/express-po-sync.mjs` (`npm run express:sync`) runs on the office PC DESKTOP-CU6S8MI, reads `POPR`/`POPRIT`/`APMAS`/`ISTAB`/`ISINFO` .DBF (VFP, windows-874; `scripts/express/dbf.mjs`) from `EXPRESS_DIR` (`D:\ACExpress\ExpressI\DHEWA66`, share `\\desktop-cu6s8mi\ACExpress`) and POSTs changed POs to `/api/cron/express-po` (Bearer `EXPRESS_SYNC_SECRET`); unchanged POs are skipped via `var/express-po-sync.json`. Express `DOCSTAT`: N ค้างรับ, M รับครบ, C ยกเลิก. All Express PO books share POPR and differ by number prefix (ISRUN `DOCTYP` PO): `PO` ใบสั่งซื้อ, `PP` ใบสั่งซื้อ-น้ำมัน, `PK` ใบสั่งซื้อ-น้ำมัน(ใหม่). `/po` lists everything except PK; `/po/pk` (menu "ใบสั่งซื้อน้ำมันใหม่ (PK)") lists PK only; both are `PoList` (`PO_BOOKS` in `src/app/(app)/po/PoList.tsx`). **PK → R3**: after a PK is approved the office opens an R3 (ตั้งหนี้บัตรเครดิต, creditor 0009) in Express with "อ้างถึงใบสั่งซื้อ" = the PK number; Express copies the lines itself. We do **not** create R3 in Express (an R3 also posts STCRD, GLJNL/GLJNLIT, APMAS.BALANCE, APBAL and their .CDX indexes; reimplementing that was judged too risky, and no VFP OLE DB driver is installed). The sync reads APTRN rows with `PONUM` into `Data.receipts` and the first non-cancelled R3 into `PurchaseOrder.R3DocNo`; `r3State()` gives "รอเปิด R3" (approved, no R3) / "R3: <no>", the PK list has a "รอเปิด R3" tab and the 08:00 summary counts them. Receipts are outside `ContentHash`, so an R3 arriving keeps the approval. A sync-script change that alters the PO payload (like adding receipts) needs one `npm run express:sync -- --full` after the server is deployed, because the 10-minute task may already have recorded the new hashes while the old server dropped the new fields. Approval (admin only, `POST /api/po/approval`, also a confirm-first button per pending row on `/po`) lives only in `PurchaseOrder.Approval*`; a sync that changes `ContentHash` (supplier/lines/prices/totals, not receiving progress) always clears the decision (audit row when there was one). **Office rule: M (fully received) counts as approved** unless rejected here: `effectiveApproval()` / `approvalWhere()` drive the badges, tabs and print stamp; "pending" = open (N) only. Combine tab and filter conditions with `AND`, never an object spread (both set `DocStat`). Sync safeguards: every request carries the ISINFO company and is refused (409 + ops alert) if it is not the stored one; a run that would flag more than half the POs as deleted is refused; the script reads the files twice and holds back POs that differ between reads (Express mid-write), and a lock file (`var/express-po-sync.lock`) keeps runs from overlapping. The worker calls `GET /api/cron/express-po` hourly 09:00-18:00 and alerts when no sync for 1 hour; the 08:00 summary shows the last sync. Task Scheduler entry on the office PC: "Dhevakij Express PO sync" (`var/express-po-sync.vbs` → `.cmd`, log `var/express-po-sync.log`; runs only while Windows is logged in). Deploy key from that PC: `~/.ssh/id_88arena_vps` (first line of the VPS `authorized_keys`, restricted to no forwarding). Cron routes check secrets with `bearerOk()` (`src/lib/cron-auth.ts`, constant time).
- **Per-vehicle records**: `src/lib/fleet/record-types.ts` is the one registry driving the generic form, the listing and the API. A field may be `type: "select"` + `master: "<master-key>"` (dropdown fed by master data); a type may set `tenanted: true` (API writes `TenantId`) and `defaults` (NOT NULL columns with no form field). Add a record type there rather than building another page. `type: "decimal"` is for non-money decimals (liters, odometer). `PATCH /api/fleet/records/[type]/[id]` edits any record type (JSON body; `VehicleId` moves the record to another vehicle); a cleared optional text field is written as `""` because several such columns are NOT NULL.

## Next 16 gotchas

- Route/page `params` and `searchParams` are **Promises**: `const { id } = await params`.
- `cookies()` / `headers()` are async.
- Server pages that query prisma need `export const dynamic = "force-dynamic"` (or call `getSession()` which reads cookies → dynamic). Avoids build-time DB calls.
- Client components need `"use client"`; those using `useSearchParams` must be wrapped in `<Suspense>` (see `fleet/installments/page.tsx`).
- Do not import server-only modules (`@/lib/db`, `@/lib/auth`) into client components.

## Deploy notes

- Ubuntu VPS: `next start` behind nginx via PM2 (`ecosystem.config.js`: web + cron worker). Cron endpoints (`/api/cron/reminders`, `/api/cron/fuel-monthly`) are hit by the worker or crontab, guarded by `CRON_SECRET`.
- Host: `ubuntu@15.235.208.118`, key `~/.ssh/id_88arena_vps`. App dir is **`/home/ubuntu/dhevakij`**, not `/opt/dhevakij` — DEPLOY.md is wrong. PM2 apps: `dhevakij-web` (port 3002) and `dhevakij-cron`. The box is shared with other apps and has no passwordless sudo (so nginx config is unreadable from a session).
- The VPS has **no GitHub credentials**, so `git pull` there fails with `could not read Username for 'https://github.com'`. Ship source with `git archive` instead (procedure below). `npm ci` can be skipped when `package-lock.json` hashes the same on both sides.
- Consequence: `git log` on the VPS shows an old commit even when the files are current. Confirm a deploy by hashing `src/` + `prisma/` on both sides (strip `\r` first — the server tree still holds CRLF files), never by git.

### Deploy procedure (follow in order)

1. Locally: `npx tsc --noEmit`, `npm run lint` (baseline 5 warnings), `npm run build`, commit, `git push`.
2. **Server must equal the last deployed commit** before overwriting: hash `src` + `prisma` from `git archive <last-deployed-sha> src prisma` and from the server tree (per-file `tr -d '\r' | sha1sum`), diff them. Any difference = someone changed the server; stop and investigate.
3. **Back up the DB** when the deploy has a migration or touches data: on the server, `pg_dump --no-owner --no-privileges "$URL" | gzip > ~/backups/dhevakij-<what>-$(date +%Y%m%d-%H%M%S).sql.gz`, where `URL` is `DATABASE_URL` from `.env` with the `?schema=public` suffix stripped (pg_dump rejects it).
4. Ship: `git archive HEAD src prisma public | ssh -i ~/.ssh/id_88arena_vps ubuntu@15.235.208.118 'tar xf - -C /home/ubuntu/dhevakij'`. Include `prisma`, or new migrations never reach the server, and `public` (PWA manifest icons). When `package.json`/`package-lock.json` or `deploy/` changed, add them to the archive and run `npm install --no-audit --no-fund` on the server before building (not `npm ci`: it deletes `node_modules` under the running app). Check the lock hash is unchanged afterwards.
5. On the server: `npx prisma migrate deploy` (a no-op when nothing is pending). If `worker/` changed, ship it too (the restart in step 6 reloads `dhevakij-cron`).
6. **Build, and restart only if the build succeeded**: `npm run build > /tmp/dhk-build.log 2>&1 && pm2 restart dhevakij-web dhevakij-cron || tail -30 /tmp/dhk-build.log`. Never pipe the build into `grep`/`head` before `&&`: the pipe swallows the exit code. On 2026-09-22 that restarted PM2 after a failed build. A failed `next build` **empties `.next`** (no `server/`, no `BUILD_ID`). The running `next start` keeps answering from memory (2026-09-30: `/login` 200 after four failed builds), but any restart then serves nothing (outage, `Could not find a production build`) until a build succeeds.
7. If the build fails at `next/font/google` ("queries have exactly one entry"), re-run the build once; do not change code. If it fails again, the cause is a stale Turbopack cache, not the network (2026-09-30: four failed retries while the server fetched the font CSS and woff2 fine, and the same commit built locally). Move the cache aside, `mv .next/cache/turbopack /tmp/dhk-turbopack-cache-$(date +%s)`, and build again (passed first try; delete the moved dir afterwards). Do not restart PM2 until a build passes: the running process keeps answering from memory even though the failed build emptied `.next`.
8. Verify: hashes equal HEAD, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/login` is 200 (app pages 307 to login), and `pm2 logs dhevakij-web --err --nostream` has nothing newer than the restart. Old `Failed to find Server Action "x"` lines are scanner bots, not us.

### Nightly DB backup

`deploy/backup-db.sh` dumps to `~/backups/dhevakij-nightly-*.sql.gz`, keeps 14 days (only `nightly` files rotate, manual pre-deploy dumps stay), refuses empty/failed dumps, and can copy off-machine with `OFFSITE=<rclone remote>`. Installed 2026-09-24 in the ubuntu crontab as `30 19 * * *` (server TZ is UTC, so 02:30 Bangkok; the 88arena backup runs at 19:00 UTC). Log: `~/backups/backup.log`. Off-machine copy since 2026-09-24: the cron line sets `OFFSITE=dhkcrypt:`. Since 2026-10-07 it also copies `UPLOAD_DIR` (bill photos, vehicle files) to `dhkcrypt:uploads` with `rclone copy` (never deletes offsite).
- rclone 1.75.1 is in `~/bin/rclone` (no sudo). `gdrive` = Google Drive with scope `drive.file` (sees only files rclone made); `dhkcrypt` = rclone crypt over `gdrive:dhevakij-backups` (names and contents encrypted). Drive keeps 90 days (`OFFSITE_KEEP_DAYS`).
- The crypt passwords are in `~/.config/rclone/DHEVAKIJ-BACKUP-PASSWORDS.txt` (600) and must also be in the owner password manager; without them the Drive copies cannot be decrypted. Never print them or the token in a session.
- **Own Google OAuth client since 2026-09-24** (rclone shared client_id is being retired): Google Cloud project `dhevakij-backup` (account devseoez@gmail.com), app "dhevakij backup", External, **In production** (Testing would expire the token every 7 days), scope `drive.file` only. Publishing required a home page and privacy URL: `https://office.phuketnukyok.com/login` and the public `/privacy` page (keep it public in `src/proxy.ts`). Desktop client "rclone nightly backup"; its id/secret live only in the server rclone.conf. The backups live in the Drive of **dhevatechnologie@gmail.com** (folder `dhevakij-backups`, id `1fqIZHflPufpuuO4dmTJQsbnf4QTV-RJN`); the Cloud project belongs to devseoez@gmail.com. `drive.file` is per client, so rclone only sees files this client made (the old shared-client folder was trashed 2026-09-24).
- Re-authorizing from this Windows PC: run `rclone config create gdrive drive scope=drive.file --config <temp file>`, read the token with `rclone config dump`, send it base64-encoded on stdin to a server-side script (PowerShell 5.1 drops quotes in native args and adds a BOM + CRLF to piped text), and use `rclone config update ... --non-interactive` there (without it, it waits for the Shared Drive question).
- Restore: `~/bin/rclone lsf dhkcrypt:`, `~/bin/rclone copy dhkcrypt:<file> /tmp/`, then `gunzip -c /tmp/<file> | psql "$URL"` into an empty database. On a new machine recreate both remotes first (Drive token + the two crypt passwords). Test locally with a fake `pg_dump` on `PATH` plus `APP_DIR`/`BACKUP_DIR` overrides.

### Loading data into production (bulk imports, one-off fixes)

- Rehearse on a **copy of production** first. Dump with `pg_dump --inserts`, create a local `dhevakij_prodcopy` DB, and run the dump with the `pg` client after dropping `\` lines (there is no local `psql`; the dump clears `search_path`, so qualify tables as `public."X"`). Run the real import code against it, check totals, and **re-run to confirm it adds 0** (idempotent). Drop the copy afterwards; it holds production data.
- Scripts that import `@/lib/db` need `tsx --conditions=react-server` (`db.ts` imports `server-only`). Put them inside the project dir (server: `/home/ubuntu/dhevakij/scripts/`) so `@prisma/client` resolves, and delete them after running. Don't commit one-off scripts.
- Check production counts still match the copy right before the real run. Take a fresh backup. Use a transaction with a dry-run (`ROLLBACK`) mode for hand-written SQL.
- Office spreadsheets: vehicle names drift between months (SY55C/SY55u, ก-8139/ก-1839). Ask the user which names are the same vehicle, never guess. Manual mappings are stored in `VehicleAlias`. Date typos can be checked against the invoice number (`IVD2601 28…` = 28/01/2026); ask before correcting.
- Merging duplicate vehicles: move every child table (`Tax`, `CompulsoryMotorInsuranceVehicle`, `InsurancePolicyVehicle`, `GasolineCost`, `RepairVehicle`, …, `DriverJob`), rewrite the `ImportKey`s that embed the old VehicleId, and add a `VehicleAlias` for the old name. Mark the old vehicle `inactive` with a note; don't delete it.
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
