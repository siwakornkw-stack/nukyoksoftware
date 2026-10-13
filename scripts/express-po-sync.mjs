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
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { readExpress, poHash } from "./express/po.mjs";

const DIR = process.env.EXPRESS_DIR || "";
const BASE = (process.env.EXPRESS_SYNC_URL || process.env.APP_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const SECRET = process.env.EXPRESS_SYNC_SECRET || "";
const STATE = path.resolve("var/express-po-sync.json");
const BATCH = 300; // keeps each request far below the proxy's 10 MB body cap
const full = process.argv.includes("--full");

if (!DIR || !SECRET) {
  console.error("ต้องตั้ง EXPRESS_DIR และ EXPRESS_SYNC_SECRET ใน .env");
  process.exit(1);
}

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

const at = new Date().toISOString();
try {
  const { purchaseOrders, company } = readExpress(DIR);
  const hashes = Object.fromEntries(purchaseOrders.map((po) => [po.poNo, poHash(po)]));
  const changed = purchaseOrders.filter((po) => state.hashes?.[po.poNo] !== hashes[po.poNo]);

  let created = 0, updated = 0;
  for (let i = 0; i < changed.length; i += BATCH) {
    const r = await post({ purchaseOrders: changed.slice(i, i + BATCH) });
    created += r.created ?? 0;
    updated += r.updated ?? 0;
  }
  // Always last: the full list of PO numbers (POs gone from Express are flagged)
  // plus the letterhead. Small, and it records the sync time on the server.
  const r = await post({ allPoNos: purchaseOrders.map((po) => po.poNo), company });

  mkdirSync(path.dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify({ at, hashes }));
  console.log(at, `express-po: ${purchaseOrders.length} POs, sent ${changed.length} (new ${created}, updated ${updated}), missing ${r.missing ?? 0}`);
} catch (e) {
  console.error(at, "express-po sync failed:", e?.message || e);
  process.exit(1);
}
