import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PO_FILE_ERROR, preparePoFile } from "@/lib/po/files";

describe("PO bill files", () => {
  it("keeps a PDF as it is", async () => {
    const pdf = Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n", "latin1");
    expect(await preparePoFile(pdf)).toEqual({ ext: "pdf", buf: pdf });
  });

  it("re-encodes a photo as JPEG of at most 2000 px", async () => {
    const png = await sharp({ create: { width: 3000, height: 1200, channels: 3, background: "#c33" } }).png().toBuffer();
    const r = await preparePoFile(png);
    if ("error" in r) throw new Error(r.error);
    expect(r.ext).toBe("jpg");
    const meta = await sharp(r.buf).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 2000, 800]);
  });

  it("refuses anything else, SVG included", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    expect(await preparePoFile(svg)).toEqual({ error: PO_FILE_ERROR });
    expect(await preparePoFile(Buffer.from("PK\x03\x04 not a bill", "latin1"))).toEqual({ error: PO_FILE_ERROR });
  });
});
