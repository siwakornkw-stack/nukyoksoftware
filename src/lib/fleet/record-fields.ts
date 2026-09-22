import { normalizeDate } from "./dates";
import type { FieldSpec } from "./record-types";

// Converts one typed-in value for a non-file, non-select field.
export function parseScalar(f: FieldSpec, value: string): { value: unknown } | { error: string } {
  if (f.type === "number") return { value: Math.trunc(Number(value)) || 0 };
  if (f.type === "money" || f.type === "decimal") return { value: Number(value) || 0 };
  if (f.type === "date") {
    const d = normalizeDate(value);
    return d ? { value: d } : { error: `วันที่ไม่ถูกต้อง: ${f.label}` };
  }
  return { value };
}
