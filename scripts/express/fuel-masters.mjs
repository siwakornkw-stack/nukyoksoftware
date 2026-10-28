// What the web needs to book a fuel bill in Express, read from the fuel PO
// history (PP / PK in POPR + POPRIT, received by H3): the fuel suppliers and
// the per-vehicle items with their department. Pure: takes parsed rows.
//
//   item.stock    STMAS STKTYP is not 5 (e.g. "140 SY", FIFO lots): only the PK
//                 is written, staff key that H3 themselves.
//   item.vatClaim the item's latest H3 claimed the VAT (FLGVAT 1). One that did
//                 not (FLGVAT 0 + a "ภาษีซื้อขอคืนไม่ได้" line) also gets the PK only.
export function buildFuelMasters({ popr, poprit, stmas, apmas, istab, aptrn, stcrd }, since = "2025-01-01") {
  const books = (no) => no.startsWith("PP") || no.startsWith("PK");
  const heads = new Map(popr.filter((p) => books(p.PONUM) && p.PODAT && p.PODAT >= since && p.DOCSTAT !== "C").map((p) => [p.PONUM, p]));
  const items = new Map(), sups = new Map();
  const stock = new Map(stmas.map((s) => [s.STKCOD, s]));
  const deps = new Map(istab.filter((t) => t.TABTYP === "50").map((t) => [t.TYPCOD, t.TYPDES || t.SHORTNAM]));

  for (const p of heads.values()) {
    const s = sups.get(p.SUPCOD) || { code: p.SUPCOD, uses: 0, last: "" };
    s.uses++;
    if (p.PODAT > s.last) s.last = p.PODAT;
    sups.set(p.SUPCOD, s);
  }
  for (const l of poprit) {
    const h = heads.get(l.PONUM);
    if (!h || !l.STKCOD) continue;
    const it = items.get(l.STKCOD) || { code: l.STKCOD, uses: 0, last: "", depCode: "" };
    it.uses++;
    if (h.PODAT >= it.last) {
      it.last = h.PODAT;
      it.depCode = l.DEPCOD || h.DEPCOD || it.depCode;
      it.lineDesc = l.STKDES;
    }
    items.set(l.STKCOD, it);
  }

  // Latest H3 per item: did it claim the VAT?
  const h3 = new Map(aptrn.filter((r) => r.DOCNUM.startsWith("H3") && r.DOCSTAT !== "C").map((r) => [r.DOCNUM, r]));
  const lastH3 = new Map();
  for (const l of stcrd) {
    const h = h3.get(l.DOCNUM);
    if (!h || !items.has(l.STKCOD)) continue;
    const prev = lastH3.get(l.STKCOD);
    if (!prev || h.DOCDAT > prev.DOCDAT) lastH3.set(l.STKCOD, h);
  }

  const supRows = [...sups.values()]
    .map((s) => {
      const a = apmas.find((x) => x.SUPCOD === s.code);
      return { code: s.code, name: a ? `${a.PRENAM} ${a.SUPNAM}`.trim() : s.code, taxId: a?.TAXID || "", branch: a?.ORGNUM ? String(a.ORGNUM) : "", uses: s.uses, last: s.last };
    })
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 60);

  const itemRows = [...items.values()]
    .map((it) => {
      const s = stock.get(it.code);
      const h = lastH3.get(it.code);
      return {
        code: it.code,
        desc: s?.STKDES || it.lineDesc || it.code,
        depCode: it.depCode,
        depName: deps.get(it.depCode) || "",
        unit: s?.PQUCOD || "ลต",
        stock: !!s && s.STKTYP !== "5",
        vatClaim: !h || h.FLGVAT !== "0",
        uses: it.uses,
        last: it.last,
      };
    })
    .filter((it) => !/ห้ามใช้/.test(it.code + it.desc)) // retired in Express ("ห้ามใช้ ค่าน้ำมันรถ…")
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 400);

  return { suppliers: supRows, items: itemRows };
}
