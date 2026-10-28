import { opsAlert } from "@/lib/ops-alert";

// Why the Gemini reader failed, in words that tell staff what to do next (the
// file is stored either way, so they type the figures by hand).
export async function readError(e: unknown, what = "fuel bill"): Promise<string> {
  const msg = (e as Error)?.message ?? "";
  console.error(`${what} read failed:`, msg);
  // A rejected or missing key fails every photo; a retry or a better photo will not help.
  if (/ (400|401|403):/.test(msg) || !process.env.GEMINI_API_KEY?.trim()) {
    await opsAlert("gemini-key", "อ่านบิลน้ำมันไม่ได้", `Gemini ปฏิเสธคีย์ (GEMINI_API_KEY): ${msg.slice(0, 300)}`);
    return "ระบบอ่านรูปใช้งานไม่ได้ตอนนี้ (คีย์ Gemini แจ้งผู้ดูแลระบบแล้ว) กรอกเองจากรูปได้";
  }
  if (/ 429:/.test(msg)) return "โควต้า AI อ่านรูปของวันนี้หมดแล้ว กรอกเองจากรูปได้";
  return "AI อ่านรูปไม่สำเร็จ กรอกเองจากรูปได้";
}
