import { PageHeader, Card } from "@/components/ui";
import { HELP_GROUPS, HELP_INTRO, type HelpSection } from "@/lib/help/content";

// Static manual. No data access and no client state, so it renders straight to
// HTML and the content never ships to the browser as JS.

export const metadata = { title: "วิธีใช้งาน" };

function Section({ s, anchor }: { s: HelpSection; anchor: string }) {
  return (
    <Card className="scroll-mt-6" >
      <div id={anchor} className="scroll-mt-6" />
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-semibold">{s.heading}</h3>
        {s.route !== "-" && (
          <code className="rounded bg-slate-800/70 px-1.5 py-0.5 text-[11px] text-sky-300">
            {s.route}
          </code>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-300">{s.purpose}</p>

      {s.steps.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            ขั้นตอน
          </div>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-300 marker:text-slate-500">
            {s.steps.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      {s.fields.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            ช่องกรอกและคอลัมน์
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <tbody>
                {s.fields.map((f, i) => (
                  <tr key={i} className="border-b border-slate-800/60 last:border-0 align-top">
                    <td className="w-56 py-1.5 pr-3 font-medium text-slate-200">
                      {f.label}
                      {f.required && <span className="ml-1 text-rose-400">*</span>}
                    </td>
                    <td className="py-1.5 text-slate-400">{f.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.fields.some((f) => f.required) && (
            <div className="mt-1.5 text-xs text-slate-500">
              <span className="text-rose-400">*</span> จำเป็นต้องกรอก
            </div>
          )}
        </div>
      )}

      {s.gotchas.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-300/80">
            ข้อควรรู้
          </div>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-300 marker:text-amber-400/60">
            {s.gotchas.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function HelpPage() {
  const total = HELP_GROUPS.reduce((n, g) => n + g.sections.length, 0);

  return (
    <div className="max-w-4xl">
      <PageHeader title="วิธีใช้งาน" subtitle={`คู่มือการใช้งานทุกส่วนของระบบ · ${total} หัวข้อ`} />

      <Card className="mb-6">
        <p className="text-sm text-slate-300">{HELP_INTRO}</p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {HELP_GROUPS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="rounded-lg bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white"
            >
              {g.title}
            </a>
          ))}
        </nav>
      </Card>

      <div className="flex flex-col gap-10">
        {HELP_GROUPS.map((g) => (
          <section key={g.id}>
            <div id={g.id} className="scroll-mt-6" />
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-sky-300">{g.title}</h2>
              <p className="text-sm text-slate-400">{g.blurb}</p>
            </div>
            <div className="flex flex-col gap-4">
              {g.sections.map((s, i) => (
                <Section key={i} s={s} anchor={`${g.id}-${i}`} />
              ))}
            </div>
            <div className="mt-3 text-right">
              <a href="#" className="text-xs text-slate-500 transition-colors hover:text-slate-300">
                กลับขึ้นด้านบน ↑
              </a>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
