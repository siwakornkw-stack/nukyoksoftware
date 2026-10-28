// Sends Express purchase orders to the app (read-only on the Express side).
// Runs on the office PC that holds the Express data, every minute from
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
// Reading POs never writes to Express. The exceptions, each with its own switch:
//   EXPRESS_FUEL_MODE="live": fuel bills saved on the web with "สั่งเปิด PK + H3"
//     get their PK (+ H3) written by scripts/express-fuel.mjs, after copying the
//     twelve tables it touches to var/express-backups/fuel-<time>/.
//   EXPRESS_R3_MODE="live": for each approved PK the app queues, the R3
//     (ตั้งหนี้บัตรเครดิต) is written from the PK's H3 by scripts/express-r3.mjs,
//     after copying the six tables it touches to var/express-backups/r3-<time>/.
//   EXPRESS_PZ_MODE="live": for each transfer slip an admin queued on a PK, the
//     PZ (จ่ายชำระหนี้-น้ำมัน) paying its R3 is written by scripts/express-pz.mjs,
//     after copying the seven tables it touches to var/express-backups/pz-<time>/.
// Every 15 minutes it also sends the master data the web needs for "สั่งเปิด
// PK + H3" and for the slips (suppliers, vehicle items, bank accounts; read-only).
// The fingerprints of what was sent are kept in
// var/express-po-sync.json (in this project, not next to the Express files),
// so an unchanged PO is not sent again.
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, statSync, unlinkSync, readdirSync, copyFileSync, rmSync } from "fs";
import path from "path";
import { readExpress, poHash } from "./express/po.mjs";
import { planR3 } from "./express/r3.mjs";
import { readR3Tables, writeR3 } from "./express-r3.mjs";
import { readDbf } from "./express/dbf.mjs";
import { buildFuelMasters } from "./express/fuel-masters.mjs";
import { planFuel } from "./express/fuel.mjs";
import { readFuelTables, writeFuel } from "./express-fuel.mjs";
import { buildBanks, planPz, r3Creditor } from "./express/pz.mjs";
import { readPzTables, writePz } from "./express-pz.mjs";

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

// ---- R3 for approved PKs (written into Express; EXPRESS_R3_MODE=live turns it on) ----
const R3_MODE = process.env.EXPRESS_R3_MODE || "off";
const R3_TABLES = ["APTRN", "STCRD", "GLJNL", "GLJNLIT", "APMAS", "APBAL"];
const BACKUPS = path.resolve("var/express-backups");
const KEEP_BACKUPS = 30; // per kind (r3-, fuel-)

// Copy the tables a write touches (with their indexes) before writing.
function backupTables(kind, tables) {
  const dest = path.join(BACKUPS, `${kind}-${at.replace(/[:.]/g, "-")}`);
  mkdirSync(dest, { recursive: true });
  const files = readdirSync(DIR);
  for (const t of tables) {
    for (const f of files.filter((n) => new RegExp(`^${t}\\.(dbf|cdx)$`, "i").test(n))) copyFileSync(path.join(DIR, f), path.join(dest, f));
  }
  const old = readdirSync(BACKUPS).filter((n) => n.startsWith(`${kind}-`)).sort();
  for (const n of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) rmSync(path.join(BACKUPS, n), { recursive: true, force: true });
  return dest;
}

async function r3Api(method, body) {
  const res = await fetch(`${BASE}/api/cron/express-r3`, {
    method,
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${out.error || ""}`.trim());
  return out;
}

async function runR3Queue() {
  if (R3_MODE !== "live") return;
  const { pk = [] } = await r3Api("GET");
  if (!pk.length) return;
  let tables = readR3Tables(DIR);
  let backup = "";
  const results = [];
  for (const pkNo of pk) {
    const plan = planR3({ pkNo, ...tables });
    if (plan.status === "exists") results.push({ pk: pkNo, status: "done", docNo: plan.docNo });
    else if (plan.status === "waiting") results.push({ pk: pkNo, status: "waiting", error: plan.reason });
    else if (plan.status !== "ready") results.push({ pk: pkNo, status: "error", error: plan.reason });
    else {
      if (!backup) backup = backupTables("r3", R3_TABLES);
      const w = writeR3(DIR, plan);
      if (w.ok) {
        results.push({ pk: pkNo, status: "done", docNo: w.docNo });
        tables = readR3Tables(DIR); // the next PK must see this R3's number
      } else results.push({ pk: pkNo, status: w.busy ? "busy" : "error", error: w.error });
    }
  }
  await r3Api("POST", { results });
  console.log(at, `express-r3: ${results.map((r) => `${r.pk} ${r.status}${r.docNo ? ` ${r.docNo}` : ""}${r.error ? ` (${r.error})` : ""}`).join(", ")}${backup ? ` · backup ${backup}` : ""}`);
}

// ---- Fuel bills -> PK (+ H3) (written into Express; EXPRESS_FUEL_MODE=live turns it on) ----
const FUEL_MODE = process.env.EXPRESS_FUEL_MODE || "off";
const FUEL_TABLES = ["POPR", "POPRIT", "ISRUN", "STMAS", "APTRN", "STCRD", "GLJNL", "GLJNLIT", "ISVAT", "APRCPCQ", "APBAL", "APMAS"];
const MASTERS_EVERY_MS = 15 * 60 * 1000;

async function fuelApi(method, body) {
  const res = await fetch(`${BASE}/api/cron/express-fuel`, {
    method,
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${out.error || ""}`.trim());
  return out;
}

// Suppliers and vehicle items for the web's "สั่งเปิด PK + H3", the bank
// accounts and R3 creditor for the transfer slips, and whether this PC writes
// queued bills / slips (the web only offers each while it does).
async function pushFuelMasters() {
  const t = (n) => readDbf(path.join(DIR, `${n}.DBF`));
  const apmas = t("APMAS");
  const masters = buildFuelMasters({ popr: t("POPR"), poprit: t("POPRIT"), stmas: t("STMAS"), apmas, istab: t("ISTAB"), aptrn: t("APTRN"), stcrd: t("STCRD") });
  const banks = buildBanks({ isrun: t("ISRUN"), bkmas: t("BKMAS"), glacc: t("GLACC") });
  await fuelApi("POST", { masters: { ...masters, writer: FUEL_MODE === "live", banks, creditor: r3Creditor(apmas), pzWriter: PZ_MODE === "live" } });
}

async function runFuelQueue() {
  if (FUEL_MODE !== "live") return;
  const { orders = [] } = await fuelApi("GET");
  if (!orders.length) return;
  let tables = readFuelTables(DIR);
  let backup = "";
  const results = [];
  for (const order of orders) {
    const plan = planFuel(order, tables);
    if (plan.status === "exists") results.push({ id: order.id, status: "done", pkNo: plan.pkNo, h3No: plan.h3No });
    else if (plan.status !== "ready") results.push({ id: order.id, status: "error", error: plan.reason });
    else {
      if (!backup) backup = backupTables("fuel", FUEL_TABLES);
      const w = writeFuel(DIR, plan);
      if (w.ok) {
        results.push({ id: order.id, status: "done", pkNo: w.pkNo, h3No: w.h3No });
        tables = readFuelTables(DIR); // the next bill must see these numbers
      } else results.push({ id: order.id, status: w.busy ? "busy" : "error", error: w.error });
    }
  }
  await fuelApi("POST", { results });
  const docs = (r) => [r.pkNo, r.h3No].filter(Boolean).join(" ");
  console.log(at, `express-fuel: ${results.map((r) => `${r.id.slice(0, 8)} ${r.status}${docs(r) ? ` ${docs(r)}` : ""}${r.error ? ` (${r.error})` : ""}`).join(", ")}${backup ? ` · backup ${backup}` : ""}`);
}

// ---- Transfer slips -> PZ paying a PK's R3 (written into Express; EXPRESS_PZ_MODE=live turns it on) ----
const PZ_MODE = process.env.EXPRESS_PZ_MODE || "off";
const PZ_TABLES = ["APTRN", "APRCPIT", "APRCPCQ", "GLJNL", "GLJNLIT", "APMAS", "APBAL"];

async function pzApi(method, body) {
  const res = await fetch(`${BASE}/api/cron/express-pz`, {
    method,
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${out.error || ""}`.trim());
  return out;
}

async function runPzQueue() {
  if (PZ_MODE !== "live") return;
  const { payments = [] } = await pzApi("GET");
  if (!payments.length) return;
  let tables = readPzTables(DIR);
  let backup = "";
  const results = [];
  for (const pay of payments) {
    const plan = planPz(pay, tables);
    if (plan.status === "exists") results.push({ id: pay.id, status: "done", pzNo: plan.pzNo });
    else if (plan.status !== "ready") results.push({ id: pay.id, status: "error", error: plan.reason });
    else {
      if (!backup) backup = backupTables("pz", PZ_TABLES);
      const w = writePz(DIR, plan);
      if (w.ok) {
        results.push({ id: pay.id, status: "done", pzNo: w.pzNo });
        tables = readPzTables(DIR); // the next slip must see this number and balance
      } else results.push({ id: pay.id, status: w.busy ? "busy" : "error", error: w.error });
    }
  }
  await pzApi("POST", { results });
  console.log(at, `express-pz: ${results.map((r) => `${r.id.slice(0, 8)} ${r.status}${r.pzNo ? ` ${r.pzNo}` : ""}${r.error ? ` (${r.error})` : ""}`).join(", ")}${backup ? ` · backup ${backup}` : ""}`);
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
  // Master data every 15 minutes, and at once when EXPRESS_FUEL_MODE or
  // EXPRESS_PZ_MODE changed. A failed send waits as well: a server without the
  // route would otherwise cost a read of ten tables every minute.
  let { fuelMastersAt, fuelMode, pzMode } = state;
  if (!fuelMastersAt || fuelMode !== FUEL_MODE || pzMode !== PZ_MODE || Date.now() - new Date(fuelMastersAt).getTime() >= MASTERS_EVERY_MS) {
    fuelMastersAt = at;
    fuelMode = FUEL_MODE;
    pzMode = PZ_MODE;
    try {
      await pushFuelMasters();
    } catch (e) {
      console.error(at, "express-fuel masters failed:", e?.message || e);
    }
  }
  writeFileSync(STATE, JSON.stringify({ at, hashes, fuelMastersAt, fuelMode, pzMode }));
  console.log(
    at,
    `express-po: ${purchaseOrders.length} POs, sent ${changed.length} (new ${created}, updated ${updated}), missing ${r.missing ?? 0}` +
      (unsettled ? `, ${unsettled} being edited (next run)` : "")
  );

  try {
    await runFuelQueue();
  } catch (e) {
    console.error(at, "express-fuel failed:", e?.message || e);
    process.exitCode = 1;
  }
  try {
    await runR3Queue();
  } catch (e) {
    console.error(at, "express-r3 failed:", e?.message || e);
    process.exitCode = 1;
  }
  try {
    await runPzQueue();
  } catch (e) {
    console.error(at, "express-pz failed:", e?.message || e);
    process.exitCode = 1;
  }
} catch (e) {
  console.error(at, "express-po sync failed:", e?.message || e);
  process.exitCode = 1;
} finally {
  unlock();
}
