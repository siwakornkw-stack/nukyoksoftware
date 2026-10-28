// Writes the PZ (PZ-จ่ายชำระหนี้-น้ำมัน) for a PK's R3 paid by a transfer slip
// uploaded on the web.
//
//   node scripts/express-pz.mjs --dir <Express company folder> --payment <payment.json>           (plan only)
//   node scripts/express-pz.mjs --dir <Express company folder> --payment <payment.json> --write   (write it)
//
// payment.json: { id, pkNo, r3No, date, amount, payType, ref } (what GET
// /api/cron/express-pz hands out). Plans with scripts/express/pz.mjs, writes
// through the VFP OLE DB provider (32-bit PowerShell + express/pz-write.ps1).
// Safe to repeat: an R3 already paid by a PZ is reported, not paid again. Each
// write leaves var/pz-ledger/<payment id>.json.
import { spawnSync } from "child_process";
import { writeFileSync, mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { readDbf } from "./express/dbf.mjs";
import { planPz } from "./express/pz.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PS32 = path.join(process.env.WINDIR || "C:\\Windows", "SysWOW64", "WindowsPowerShell", "v1.0", "powershell.exe");
export const PZ_LEDGER_DIR = path.resolve("var/pz-ledger");

export function readPzTables(dir) {
  const t = (n) => readDbf(path.join(dir, `${n}.DBF`));
  return { aptrn: t("APTRN"), aprcpit: t("APRCPIT"), apmas: t("APMAS"), isrun: t("ISRUN"), isprd: t("ISPRD") };
}

export function writePz(dir, plan) {
  mkdirSync(PZ_LEDGER_DIR, { recursive: true });
  const ledger = path.join(PZ_LEDGER_DIR, `${plan.paymentId}.json`);
  // A run that died half way, or could not undo itself, needs a person first.
  if (existsSync(ledger)) {
    let prev = {};
    try {
      prev = JSON.parse(readFileSync(ledger, "utf8").replace(/^\uFEFF/, ""));
    } catch {}
    if (prev.status === "writing" || prev.status === "ROLLBACK-FAILED") {
      return { ok: false, stuck: true, error: `การจ่ายนี้เขียนลง Express ค้างไว้ไม่สมบูรณ์ (${prev.status} ${prev.pzNo || ""}) ต้องตรวจใน Express ก่อน: ${ledger}` };
    }
  }
  const tmp = mkdtempSync(path.join(tmpdir(), "pz-"));
  try {
    const planFile = path.join(tmp, "plan.json");
    writeFileSync(planFile, JSON.stringify(plan), "utf8");
    const r = spawnSync(
      PS32,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(here, "express", "pz-write.ps1"), "-Dir", dir, "-PlanFile", planFile, "-Ledger", ledger],
      { encoding: "utf8", timeout: 180000 }
    );
    const line = (r.stdout || "").split(/\r?\n/).find((l) => l.startsWith("RESULT:"));
    if (!line) return { ok: false, error: `writer gave no result: ${(r.stderr || r.stdout || r.error?.message || "").trim().slice(0, 300)}` };
    const res = line.slice(7);
    if (res.startsWith("OK:")) return { ok: true, pzNo: res.slice(3).trim() };
    if (res.startsWith("EXISTS:")) return { ok: true, existed: true, pzNo: res.slice(7).trim() };
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
  const dir = arg("--dir"), file = arg("--payment");
  if (!dir || !file) {
    console.error("usage: node scripts/express-pz.mjs --dir <Express company folder> --payment <payment.json> [--write]");
    process.exit(1);
  }
  const pay = JSON.parse(readFileSync(file, "utf8"));
  const plan = planPz(pay, readPzTables(dir));
  console.log(JSON.stringify(plan, null, 2));
  if (process.argv.includes("--write") && plan.status === "ready") {
    const w = writePz(dir, plan);
    console.log(JSON.stringify(w));
    process.exit(w.ok ? 0 : 1);
  }
}
