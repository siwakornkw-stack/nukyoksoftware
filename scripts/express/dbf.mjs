// Minimal read-only reader for Express Accounting tables (Visual FoxPro .DBF,
// Thai text in windows-874). Plain Node, no dependencies: it runs on the office
// PC that holds the Express data, not only inside the app.
//
// Express must never be modified, so this only ever reads: readFileSync opens
// the file read-only and nothing here writes, locks or creates files next to it.
import { readFileSync } from "fs";

const td = new TextDecoder("windows-874");

// "20250109" -> "2025-01-09"; blank -> null.
function dbfDate(s) {
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
}

// Parse a whole table from a Buffer. Deleted rows (marked "*") are skipped.
// Types: C text, N numeric text, D date, L logical, B double, I int32, Y currency.
export function parseDbf(buf) {
  const count = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);
  const fields = [];
  let off = 1; // byte 0 of a record is the deleted flag
  for (let p = 32; p + 32 <= headerLen && buf[p] !== 0x0d; p += 32) {
    const name = buf.toString("latin1", p, p + 11).replace(/\0.*$/, "");
    const type = String.fromCharCode(buf[p + 11]);
    const len = buf[p + 16];
    fields.push({ name, type, len, off });
    off += len;
  }
  const rows = [];
  for (let i = 0; i < count; i++) {
    const start = headerLen + i * recLen;
    if (start + recLen > buf.length) break; // file still being appended to
    if (buf[start] === 0x2a) continue;
    const row = {};
    for (const f of fields) {
      const raw = buf.subarray(start + f.off, start + f.off + f.len);
      switch (f.type) {
        case "B": row[f.name] = raw.readDoubleLE(0); break;
        case "I": row[f.name] = raw.readInt32LE(0); break;
        case "Y": row[f.name] = Number(raw.readBigInt64LE(0)) / 10000; break;
        case "N": case "F": { const t = raw.toString("latin1").trim(); row[f.name] = t ? Number(t) : 0; break; }
        case "D": row[f.name] = dbfDate(raw.toString("latin1").trim()); break;
        case "L": row[f.name] = /^[TtYy]/.test(raw.toString("latin1")); break;
        case "C": row[f.name] = td.decode(raw).replace(/\0/g, "").trim(); break;
        default: break; // memo/general fields are not needed
      }
    }
    rows.push(row);
  }
  return rows;
}

export function readDbf(path) {
  return parseDbf(readFileSync(path));
}
