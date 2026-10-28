// Bill extraction via Google Gemini (ported from โปรแกรมนำมัน/src/extract.js).
// Free-tier models get congested (429/503); try a chain so one busy model does not block extraction.
// Each model has its own daily quota. 2026-10-07: 2.5-flash allows only 20 requests a
// day and often needs over 20 s per bill; flash-lite read the test bills right in 5-9 s.
// flash-latest did not answer within 40 s; 2.0-flash is retired (404).
const MODELS = process.env.EXTRACT_MODEL
  ? [process.env.EXTRACT_MODEL]
  : ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
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
- receipt_no: เลขที่ใบกำกับภาษี ตามที่พิมพ์หลังคำว่า "เลขที่ใบกำกับภาษี" หรือ "เลขที่ :" คัดลอกทุกตัวอักษรตามจริง รวมตัวอักษรไทยหรืออังกฤษตัวแรก (เช่น ต26102812010782, TIO000016910000399) ไม่ใช่เลข POS หรือเลขที่ขึ้นต้นด้วย #
- station: ชื่อแบรนด์ปั๊มและสาขาที่เติมจริง เช่น "บางจาก บายพาสภูเก็ต กม.4" (ไม่ใช่ชื่อบริษัทหรือที่อยู่สำนักงานใหญ่บนหัวบิล)
- bill_date: วันที่ในบิล รูปแบบ YYYY-MM-DD (บิลไทยเขียนแบบ วัน/เดือน/ปี และถ้าเป็นปี พ.ศ. ให้แปลงเป็น ค.ศ. โดยลบ 543)
- bill_time: เวลาในบิล รูปแบบ HH:MM แบบ 24 ชั่วโมง
- fuel_type: ชนิดน้ำมัน เช่น ดีเซล, GASOHOL 95S EVO
- liters: จำนวนลิตร
- price_per_liter: ราคาต่อลิตร (บาท)
- total: ยอดรวมสุทธิที่จ่ายจริง รวม VAT แล้ว (บรรทัด "รวมทั้งสิ้น" ไม่ใช่ "มูลค่าก่อนภาษี")
- plate: ข้อความหลังคำว่า "ทะเบียนรถ" เท่านั้น (เช่น 81-2993, sy200) ไม่ใช่เลขบัตรหรือเลขอื่น ถ้าไม่มีคำว่าทะเบียนรถ ให้ใส่ null
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
  return askGemini<ExtractedBill>(imageBuffer, mediaType, PROMPT, BILL_SCHEMA);
}

// ---- Odometer / hour-meter photos (fuel bill import, one per bill) ----

const ODOMETER_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_meter: { type: "BOOLEAN" },
    reading: nullableNum,
    unit: nullableStr,
  },
  required: ["is_meter", "reading", "unit"],
};

const ODOMETER_PROMPT = `รูปนี้คือหน้าปัดเลขไมล์รถ (กิโลเมตร) หรือชั่วโมงทำงานของเครื่องจักร (ชั่วโมง) อ่านแล้วตอบ:
- reading: ตัวเลขเลขไมล์รวม (ODO / TOTAL) หรือชั่วโมงทำงานรวม ไม่ใช่ทริป (TRIP A/B) ไม่ใช่ความเร็วหรือรอบเครื่อง ถ้ามีทศนิยม (ตัวเลขช่องสุดท้ายสีต่าง หรือหลังจุด) ให้ใส่เป็นทศนิยม
- unit: "km" ถ้าเป็นกิโลเมตร, "hours" ถ้าเป็นชั่วโมงเครื่องจักร, null ถ้าไม่แน่ใจ
- is_meter: true ถ้ารูปนี้เป็นหน้าปัดเลขไมล์หรือชั่วโมงจริง, false ถ้าเป็นรูปอื่น
อ่านไม่ออกให้ใส่ reading เป็น null`;

export interface ExtractedOdometer {
  is_meter: boolean;
  reading: number | null;
  unit: string | null;
}

export async function extractOdometer(imageBuffer: Buffer, mediaType = "image/jpeg"): Promise<ExtractedOdometer> {
  return askGemini<ExtractedOdometer>(imageBuffer, mediaType, ODOMETER_PROMPT, ODOMETER_SCHEMA);
}

// One image + prompt -> JSON matching `schema`, trying each model in turn.
async function askGemini<T>(imageBuffer: Buffer, mediaType: string, prompt: string, schema: object): Promise<T> {
  const key = process.env.GEMINI_API_KEY?.trim();
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mediaType, data: imageBuffer.toString("base64") } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema },
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
        return JSON.parse(text) as T;
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
