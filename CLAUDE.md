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
npm test               # vitest (tests/*.test.ts; pure logic, no DB)
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
- **Roles**: `admin` | `staff` (`Customer.Role`, managed at `/settings/users`). Admin only: deletes (vehicles, per-vehicle records, master data), debt version switch, LINE admin settings, users, audit log. Guard with `if (!isAdmin(s)) return …403`. `getSession` re-reads the user each request, so deactivation/role changes apply immediately.
- **Untrusted JSON**: coerce to string before it reaches a Prisma `where` (`typeof v === "string" ? v.trim() : ""`). An object like `{ not: "" }` otherwise acts as a filter (was exploitable on login and debt status).
- **Races**: "check then create" needs a DB constraint behind it (one open loan per asset: partial unique index in SQL only; one row per installment number: `@@unique`). Catch `P2002` and answer 400.
- **Notifications**: one row per (user, `Key`) — e.g. `tax|<TaxId>`, `loan|<id>`, `job|<id>`; upsert so a repeat reminder refreshes the row and marks it unread. The cron writes them for every active user.
- **Login throttle** (`src/lib/rate-limit.ts`, in memory, fine while PM2 runs one web process): 5 failures per (IP, username), 20 per username, 20 per IP (only when the IP is known) in 15 minutes lock for 15 minutes. IP = `X-Real-IP`, else the last `X-Forwarded-For` hop; never the first hop (client-controlled). Verified on production 2026-09-24: nginx passes the real client IP (requests through the domain and from localhost count separately), and a spoofed `X-Forwarded-For` does not escape the limit.
- **LINE bot commands**: `id` answers anyone (needed to link drivers); `รายงาน` answers only the LINE admin ids from fuel settings; `รับ/เสร็จ <jobNo>` only the driver the job is assigned to.
- **Audit**: call `audit(entity, id, action, username, before, after)` after money-related or account changes. It never throws.
- **Tenancy**: multi-tenant schema kept, but this is a single-company install — one seeded tenant `DEFAULT_TENANT_ID`. Always scope by it (fleet child records: `where: { Vehicle: { TenantId: DEFAULT_TENANT_ID } }`).
- **Auth gate**: `src/proxy.ts` (Next 16 proxy/middleware) redirects unauthenticated navigation to `/login`. `(app)/layout.tsx` also redirects as defense-in-depth. NOTE: the build's `middleware-manifest.json` looks empty but the proxy **does** run (verified at runtime) — don't "fix" it by renaming.
- **Money**: Prisma `Decimal` everywhere. Read with `dec(x)` / `Number(x)`; write by passing a number. Convert Decimal→number at every API/JSON boundary (Decimal serializes to a string otherwise, breaking client arithmetic).
- **Dates**: `normalizeDate` builds **UTC-midnight** Dates; the server runs `TZ=UTC` (ecosystem.config.js) so `toISOString().slice(0,10)` round-trips stably. Bangkok-specific formatting uses explicit `Intl.DateTimeFormat({ timeZone: "Asia/Bangkok" })` (see fuel cron/webhook).
- **Thai Buddhist-Era years**: handled in `normalizeDate` (4-digit `≥2400 → -543`; 2-digit `>43 → BE`, else CE; Excel serials whose year is ≥2400, i.e. "5/5/2569" typed into Excel, also get `-543`).
- **Office Excel imports** (`/fleet/fuel/import`, `/fleet/insurance/import`, `src/lib/fleet/office-import.ts`): preview first, then commit. Rows dedupe on `ImportKey`, fixed at import time (fuel: `vehicleId|date|invoice|amount`; insurance: `kind|vehicleId|endDate`, plus the current vehicle+kind+expiry), so web edits don't cause duplicates on re-import. Existing rows are skipped, except that an insurance row's note from the file is applied to the stored records (`ใหม่ (เดิม: เก่า)` when there was an old note; an empty note in the file changes nothing).
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
4. Ship: `git archive HEAD src prisma | ssh -i ~/.ssh/id_88arena_vps ubuntu@15.235.208.118 'tar xf - -C /home/ubuntu/dhevakij'`. Include `prisma`, or new migrations never reach the server. When `package.json`/`package-lock.json` or `deploy/` changed, add them to the archive and run `npm install --no-audit --no-fund` on the server before building (not `npm ci`: it deletes `node_modules` under the running app). Check the lock hash is unchanged afterwards.
5. On the server: `npx prisma migrate deploy` (a no-op when nothing is pending).
6. **Build, and restart only if the build succeeded**: `npm run build > /tmp/dhk-build.log 2>&1 && pm2 restart dhevakij-web dhevakij-cron || tail -30 /tmp/dhk-build.log`. Never pipe the build into `grep`/`head` before `&&`: the pipe swallows the exit code. On 2026-09-22 that restarted PM2 after a failed build. A failed `next build` **deletes `.next`**, so `next start` then serves nothing (outage, `Could not find a production build`) until a build succeeds.
7. If the build fails at `next/font/google` ("queries have exactly one entry"), it is a transient Google Fonts download failure. Re-run the build; do not change code.
8. Verify: hashes equal HEAD, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/login` is 200 (app pages 307 to login), and `pm2 logs dhevakij-web --err --nostream` has nothing newer than the restart. Old `Failed to find Server Action "x"` lines are scanner bots, not us.

### Nightly DB backup

`deploy/backup-db.sh` dumps to `~/backups/dhevakij-nightly-*.sql.gz`, keeps 14 days (only `nightly` files rotate, manual pre-deploy dumps stay), refuses empty/failed dumps, and can copy off-machine with `OFFSITE=<rclone remote>`. Installed 2026-09-24 in the ubuntu crontab as `30 19 * * *` (server TZ is UTC, so 02:30 Bangkok; the 88arena backup runs at 19:00 UTC). Log: `~/backups/backup.log`. Off-machine copy since 2026-09-24: the cron line sets `OFFSITE=dhkcrypt:`.
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
