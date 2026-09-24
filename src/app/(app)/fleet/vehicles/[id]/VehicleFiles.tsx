"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { thDateTime } from "@/lib/format";

interface FileRow { AttachFileVehicleId: string; FileName: string; Description: string; Url: string; CreatedAt: string }
interface ImageRow { ImageVehicleId: string; Title: string; Description: string; Url: string; CreatedAt: string }

// Documents and photos of this vehicle (private files under /uploads).
export function VehicleFiles({ vehicleId, admin }: { vehicleId: string; admin: boolean }) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const api = `/api/fleet/vehicles/${vehicleId}/files`;

  const load = useCallback(() => {
    fetch(api)
      .then((r) => r.json())
      .then((d) => {
        setFiles(d.files ?? []);
        setImages(d.images ?? []);
      });
  }, [api]);
  useEffect(load, [load]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setErr("");
    setBusy(true);
    const res = await fetch(api, { method: "POST", body: new FormData(form) }).finally(() => setBusy(false));
    if (res.ok) {
      form.reset();
      load();
    } else setErr((await res.json().catch(() => ({}))).error || "อัปโหลดไม่สำเร็จ");
  }

  async function remove(kind: "file" | "image", fileId: string, name: string) {
    if (!confirm(`ลบ ${name}?`)) return;
    const res = await fetch(`${api}?kind=${kind}&fileId=${fileId}`, { method: "DELETE" });
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error || "ลบไม่สำเร็จ");
    load();
  }

  return (
    <Card className="mt-4">
      <div className="font-medium mb-3">เอกสารและรูปภาพ</div>
      <form onSubmit={upload} className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <select name="kind" className="field w-auto py-1">
          <option value="file">เอกสาร</option>
          <option value="image">รูปภาพ</option>
        </select>
        <input type="file" name="file" required className="text-xs" accept=".pdf,.xlsx,.xls,.docx,.doc,.csv,.jpg,.jpeg,.png,.webp,.gif" />
        <input name="description" className="field max-w-xs py-1" placeholder="คำอธิบาย เช่น เล่มทะเบียน, กรมธรรม์ 2569" />
        <button disabled={busy} className="rounded-lg px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-900 font-medium disabled:opacity-50">
          {busy ? "กำลังอัปโหลด..." : "อัปโหลด"}
        </button>
        <span className="text-xs text-slate-500">ไม่เกิน 10 MB</span>
      </form>
      {err && <div className="mb-3 text-sm text-rose-400">{err}</div>}

      {images.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((i) => (
            <div key={i.ImageVehicleId} className="rounded-lg border border-slate-800 p-1.5 text-xs">
              <a href={i.Url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- private file behind a session, not optimizable */}
                <img src={i.Url} alt={i.Description || i.Title} className="h-32 w-full rounded object-cover" />
              </a>
              <div className="mt-1 truncate text-slate-300">{i.Description || i.Title}</div>
              {admin && (
                <button onClick={() => remove("image", i.ImageVehicleId, i.Title)} className="text-rose-400 hover:text-rose-300">ลบ</button>
              )}
            </div>
          ))}
        </div>
      )}

      <table className="w-full text-sm">
        <tbody>
          {files.map((f) => (
            <tr key={f.AttachFileVehicleId} className="border-b border-slate-800/50">
              <td className="py-1.5 pr-3">
                <a href={f.Url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">{f.FileName}</a>
              </td>
              <td className="py-1.5 pr-3 text-slate-400">{f.Description}</td>
              <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">{thDateTime(f.CreatedAt)}</td>
              <td className="py-1.5 text-right">
                {admin && (
                  <button onClick={() => remove("file", f.AttachFileVehicleId, f.FileName)} className="text-xs text-rose-400 hover:text-rose-300">ลบ</button>
                )}
              </td>
            </tr>
          ))}
          {!files.length && !images.length && (
            <tr>
              <td className="py-6 text-center text-slate-500">ยังไม่มีเอกสารหรือรูปภาพ</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
