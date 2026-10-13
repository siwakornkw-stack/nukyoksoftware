// Sends Express purchase orders to the app (read-only on the Express side).
// Runs on the office PC that holds the Express data, e.g. every 10 minutes from
// Windows Task Scheduler:
//
//   node --env-file=.env scripts/express-po-sync.mjs          (changed POs only)
//   node --env-file=.env scripts/express-po-sync.mjs --full   (resend everything)
//
// .env on that PC:
//   EXPRESS_DIR="D:\ACExpress\ExpressI\DHEWA66"   company folder holding POPR.DBF
//   EXPRESS_SYNC_URL="https://office.example.com"   the app origin
//   EXPRESS_SYNC_SECRET="..."                       same value as on the server
//
// Express is never written to. The fingerprints of what was sent are kept in
// var/express-po-sync.json (in this project, not next to the Express files),
// so an unchanged PO is not sent again.
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, statSync, unlinkSync } from "fs";
import path from "path";
import { readExpress, poHash } from "./express/po.mjs";

const DIR = process.env.EXPRESS_DIR || "";
const BASE = (process.env.EXPRESS_SYNC_URL || process.env.APP_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const SECRET = process.env.EXPRESS_SYNC_SECRET || "";
const STATE = path.resolve("var/express-po-sync.json");
const LOCK = path.resolve("var/express-po-sync.lock");
const LOCK_STALE_MS = 15 * 60 * 1000; // a crashed run's lock is ignored after this
const BATCH = 300; // keeps each request far below the proxy's 10 MB body cap
const full = process.argv.includes("--full");
const at = new Date().toISOString();

if (!DIR || !SECRET) {
  console.error("ต้องตั้ง EXPRESS_DIR และ EXPRESS_SYNC_SECRET ใน .env");
  process.exit(1);
}

// One run at a time (Task Scheduler plus a manual run would race).
mkdirSync(path.dirname(LOCK), { recursive: true });
try {
  closeSync(openSync(LOCK, "wx"));
} catch {
  let age = 0;
  try {
    age = Date.now() - statSync(LOCK).mtimeMs;
  } catch {}
  if (age < LOCK_STALE_MS) {
    console.log(at, "express-po: another sync is running, skipped");
    process.exit(0);
  }
  writeFileSync(LOCK, String(process.pid)); // stale lock from a crashed run: take it over
}
const unlock = () => {
  try {
    unlinkSync(LOCK);
  } catch {}
};

let state = {};
if (!full) {
  try {
    state = JSON.parse(readFileSync(STATE, "utf8"));
  } catch {}
}

async function post(body) {
  const res = await fetch(`${BASE}/api/cron/express-po`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${out.error || ""}`.trim());
  return out;
}

try {
  // Read twice: Express may be writing while we read, and a half-written record
  // would sync wrong figures (and reset an approval). Only POs that read the
  // same both times are sent; the rest wait for the next run.
  const first = readExpress(DIR);
  const { purchaseOrders, company } = readExpress(DIR);
  const firstHash = new Map(first.purchaseOrders.map((po) => [po.poNo, poHash(po)]));
  const hashes = { ...(state.hashes || {}) };
  const changed = [];
  let unsettled = 0;
  for (const po of purchaseOrders) {
    const h = poHash(po);
    if (firstHash.get(po.poNo) !== h) {
      unsettled++;
      continue;
    }
    if (hashes[po.poNo] !== h) changed.push(po);
    hashes[po.poNo] = h;
  }

  let created = 0, updated = 0;
  for (let i = 0; i < changed.length; i += BATCH) {
    const r = await post({ company, purchaseOrders: changed.slice(i, i + BATCH) });
    created += r.created ?? 0;
    updated += r.updated ?? 0;
  }
  // Always last: the full list of PO numbers (POs gone from Express are flagged)
  // plus the letterhead. Small, and it records the sync time on the server.
  const r = await post({ company, allPoNos: purchaseOrders.map((po) => po.poNo) });

  for (const no of Object.keys(hashes)) if (!firstHash.has(no)) delete hashes[no];
  writeFileSync(STATE, JSON.stringify({ at, hashes }));
  console.log(
    at,
    `express-po: ${purchaseOrders.length} POs, sent ${changed.length} (new ${created}, updated ${updated}), missing ${r.missing ?? 0}` +
      (unsettled ? `, ${unsettled} being edited (next run)` : "")
  );
} catch (e) {
  console.error(at, "express-po sync failed:", e?.message || e);
  process.exitCode = 1;
} finally {
  unlock();
}
