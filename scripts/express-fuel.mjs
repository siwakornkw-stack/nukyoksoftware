// Writes the PK (+ H3) for fuel bills saved on the web into Express.
//
//   node scripts/express-fuel.mjs --dir <Express company folder> --order <order.json>           (plan only)
//   node scripts/express-fuel.mjs --dir <Express company folder> --order <order.json> --write   (write it)
//
// order.json: { id, withH3, supplier, item, dep, date, invoice, liters, price, amount }
// (what GET /api/cron/express-fuel hands out). Plans with scripts/express/fuel.mjs,
// writes through the VFP OLE DB provider (32-bit PowerShell + express/fuel-write.ps1).
// Safe to repeat: an H3 with this tax invoice, or a PK with it in "อ้างอิง", is
// reported, not written again. Each write leaves var/fuel-ledger/<order id>.json.
import { spawnSync } from "child_process";
import { writeFileSync, mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { readDbf } from "./express/dbf.mjs";
import { planFuel } from "./express/fuel.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PS32 = path.join(process.env.WINDIR || "C:\\Windows", "SysWOW64", "WindowsPowerShell", "v1.0", "powershell.exe");
export const FUEL_LEDGER_DIR = path.resolve("var/fuel-ledger");

export function readFuelTables(dir) {
  const t = (n) => readDbf(path.join(dir, `${n}.DBF`));
  return { popr: t("POPR"), poprit: t("POPRIT"), stmas: t("STMAS"), apmas: t("APMAS"), aptrn: t("APTRN"), isprd: t("ISPRD"), isrun: t("ISRUN") };
}

export function writeFuel(dir, plan) {
  mkdirSync(FUEL_LEDGER_DIR, { recursive: true });
  const ledger = path.join(FUEL_LEDGER_DIR, `${plan.orderId}.json`);
  // A run that died half way, or could not undo itself, needs a person first.
  if (existsSync(ledger)) {
    let prev = {};
    try {
      prev = JSON.parse(readFileSync(ledger, "utf8").replace(/^\uFEFF/, ""));
    } catch {}
    if (prev.status === "writing" || prev.status === "ROLLBACK-FAILED") {
      return { ok: false, stuck: true, error: `บิลนี้เขียนลง Express ค้างไว้ไม่สมบูรณ์ (${prev.status} ${prev.pkNo || ""} ${prev.h3No || ""}) ต้องตรวจใน Express ก่อน: ${ledger}` };
    }
  }
  const tmp = mkdtempSync(path.join(tmpdir(), "fuel-"));
  try {
    const planFile = path.join(tmp, "plan.json");
    writeFileSync(planFile, JSON.stringify(plan), "utf8");
    const r = spawnSync(
      PS32,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(here, "express", "fuel-write.ps1"), "-Dir", dir, "-PlanFile", planFile, "-Ledger", ledger],
      { encoding: "utf8", timeout: 180000 }
    );
    const line = (r.stdout || "").split(/\r?\n/).find((l) => l.startsWith("RESULT:"));
    if (!line) return { ok: false, error: `writer gave no result: ${(r.stderr || r.stdout || r.error?.message || "").trim().slice(0, 300)}` };
    const res = line.slice(7);
    const docs = (s) => {
      const [pkNo = "", h3No = ""] = s.split("|");
      return { pkNo: pkNo.trim(), h3No: h3No.trim() };
    };
    if (res.startsWith("OK:")) return { ok: true, ...docs(res.slice(3)) };
    if (res.startsWith("EXISTS:")) return { ok: true, existed: true, ...docs(res.slice(7)) };
    if (res.startsWith("BUSY:")) return { ok: false, busy: true, error: res.slice(5) };
    return { ok: false, error: res.replace(/^ERR:/, "") };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => {
    const i = process.argv.indexOf(k);
    return i > 0 ? process.argv[i + 1] : "";
  };
  const dir = arg("--dir"), orderFile = arg("--order");
  if (!dir || !orderFile) {
    console.error("usage: node scripts/express-fuel.mjs --dir <Express company folder> --order <order.json> [--write]");
    process.exit(1);
  }
  const order = JSON.parse(readFileSync(orderFile, "utf8"));
  const plan = planFuel(order, readFuelTables(dir));
  console.log(JSON.stringify(plan, null, 2));
  if (process.argv.includes("--write") && plan.status === "ready") {
    const w = writeFuel(dir, plan);
    console.log(JSON.stringify(w));
    process.exit(w.ok ? 0 : 1);
  }
}
