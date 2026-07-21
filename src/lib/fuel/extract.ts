// Bill extraction via Google Gemini (ported from โปรแกรมนำมัน/src/extract.js).
// Free-tier models get congested (429/503); try a chain so one busy model does not block extraction.
const MODELS = process.env.EXTRACT_MODEL
  ? [process.env.EXTRACT_MODEL]
  : ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
const REQUEST_TIMEOUT_MS = 20_000;

const nullableStr = { type: "STRING", nullable: true };
const nullableNum = { type: "NUMBER", nullable: true };

const BILL_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_fuel_bill: { type: "BOOLEAN" },
    receipt_no: nullableStr,
    station: nullableStr,
    bill_date: nullableStr,
    bill_time: nullableStr,
    fuel_type: nullableStr,
    liters: nullableNum,
    price_per_liter: nullableNum,
    total: nullableNum,
    plate: nullableStr,
  },
  required: [
    "is_fuel_bill", "receipt_no", "station", "bill_date", "bill_time",
    "fuel_type", "liters", "price_per_liter", "total", "plate",
  ],
};

const PROMPT = `อ่านรูปใบเสร็จ/บิลเติมน้ำมันนี้ (ปั๊มน้ำมันในประเทศไทย) แล้วดึงข้อมูล:
- receipt_no: เลขที่ใบกำกับภาษี/ใบเสร็จ (มักขึ้นต้นด้วย "เลขที่")
- station: ชื่อแบรนด์ปั๊มและสาขาที่เติมจริง เช่น "บางจาก บายพาสภูเก็ต กม.4" (ไม่ใช่ชื่อบริษัทหรือที่อยู่สำนักงานใหญ่บนหัวบิล)
- bill_date: วันที่ในบิล รูปแบบ YYYY-MM-DD (บิลไทยเขียนแบบ วัน/เดือน/ปี และถ้าเป็นปี พ.ศ. ให้แปลงเป็น ค.ศ. โดยลบ 543)
- bill_time: เวลาในบิล รูปแบบ HH:MM แบบ 24 ชั่วโมง
- fuel_type: ชนิดน้ำมัน เช่น ดีเซล, GASOHOL 95S EVO
- liters: จำนวนลิตร
- price_per_liter: ราคาต่อลิตร (บาท)
- total: ยอดรวมสุทธิที่จ่ายจริง รวม VAT แล้ว (บรรทัด "รวมทั้งสิ้น" ไม่ใช่ "มูลค่าก่อนภาษี")
- plate: ทะเบียนรถ ถ้ามีระบุในบิล
- is_fuel_bill: true ถ้ารูปนี้เป็นบิลเติมน้ำมันจริง, false ถ้าเป็นรูปอื่น
ช่องไหนอ่านไม่ออกหรือไม่มีในบิล ให้ใส่ null`;

export interface ExtractedBill {
  is_fuel_bill: boolean;
  receipt_no: string | null;
  station: string | null;
  bill_date: string | null;
  bill_time: string | null;
  fuel_type: string | null;
  liters: number | null;
  price_per_liter: number | null;
  total: number | null;
  plate: string | null;
}

export async function extractBill(
  imageBuffer: Buffer,
  mediaType = "image/jpeg"
): Promise<ExtractedBill> {
  const key = process.env.GEMINI_API_KEY?.trim();
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mediaType, data: imageBuffer.toString("base64") } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", responseSchema: BILL_SCHEMA },
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const TRANSIENT = [429, 500, 502, 503, 504];

  let lastErr = "";
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        lastErr = `gemini ${model} request error: ${(err as Error)?.message || err}`;
        if (attempt < 3) {
          await sleep(1200 * attempt);
          continue;
        }
        break;
      }
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("gemini: no text in response: " + JSON.stringify(data).slice(0, 400));
        return JSON.parse(text) as ExtractedBill;
      }
      lastErr = `gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`;
      if (TRANSIENT.includes(res.status) && attempt < 3) {
        await sleep(1200 * attempt);
        continue;
      }
      break;
    }
  }
  throw new Error(lastErr || "gemini: all models failed");
}
