import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { searchAll } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const groups = await searchAll(q);
  const total = groups.reduce((a, g) => a + g.hits.length, 0);

  return (
    <div className="max-w-4xl">
      <PageHeader title="ค้นหา" subtitle={q ? `"${q}" · ${total} รายการ` : "พิมพ์ทะเบียนรถ เลขเอกสาร ชื่อลูกค้า ชื่อคนขับ หรือสินทรัพย์"} />
      <form action="/search" className="mb-4">
        <input name="q" defaultValue={q} autoFocus className="field max-w-md" placeholder="ค้นหา (อย่างน้อย 2 ตัวอักษร)" />
      </form>
      {q.length >= 2 && !groups.length && <Card>ไม่พบรายการที่ตรงกับ &quot;{q}&quot;</Card>}
      <div className="grid gap-4">
        {groups.map((g) => (
          <Card key={g.label}>
            <div className="font-medium mb-2">
              {g.label} <span className="text-xs text-slate-500">({g.hits.length}{g.hits.length === 8 ? "+" : ""})</span>
            </div>
            {g.hits.map((h, i) => (
              <Link key={i} href={h.href} className="block rounded-lg px-2 py-1.5 hover:bg-slate-800/50">
                <div className="text-sm">{h.title}</div>
                {h.sub && <div className="text-xs text-slate-500">{h.sub}</div>}
              </Link>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
