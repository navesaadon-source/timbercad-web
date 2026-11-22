import { useState } from "react";
import { Paperclip, X, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { HardwareForm, MaterialForm } from "./SpecForms";
import { Field } from "./ui";
import type { FrontsSpec, HardwareSpec, MaterialSpec } from "@/lib/types";

export interface Draft { project_name: string; hardware: HardwareSpec; carcass: MaterialSpec; fronts: FrontsSpec; notes: string }

export function OrderEditor({ initial, onSave, saveLabel, busy, fromDefaults, withFiles, onCancel }:
  { initial: Draft; onSave: (d: Draft, files: File[]) => void; saveLabel: string; busy?: boolean; fromDefaults?: boolean; withFiles?: boolean; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState("");
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.project_name.trim()) { setErr("צריך לתת שם לפרויקט"); return; }
    if (!d.hardware.connection_method) { setErr("בחר שיטת חיבור לארון"); return; }
    setErr("");
    const fronts = d.fronts.same_as_carcass ? { ...d.carcass, same_as_carcass: true } : d.fronts;
    onSave({ ...d, project_name: d.project_name.trim(), fronts }, files);
  };

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <section className="panel grid gap-4 p-5">
        <Field label="שם הפרויקט" id="pname" hint="השם הזה ישמש גם לתיקיית העבודה, למשל: מטבח משפחת לוי">
          <input id="pname" className="field text-lg" value={d.project_name} onChange={(e) => set({ project_name: e.target.value })} required />
        </Field>
      </section>

      <section className="panel p-5">
        <h2 className="mb-1 text-2xl">חיבור ופרזול</h2>
        {fromDefaults && (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-info/8 p-3 text-sm text-info">
            <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <span>נטען מהסטנדרט שלך. שינוי כאן חל רק על ההזמנה הזו. <Link to="/portal/settings" className="font-semibold underline">עריכת הסטנדרט</Link></span>
          </p>
        )}
        <HardwareForm value={d.hardware} onChange={(hardware) => set({ hardware })} />
      </section>

      <section className="panel grid gap-6 p-5">
        <div><h2 className="mb-3 text-2xl">גוף הארון</h2><MaterialForm kind="carcass" value={d.carcass} onChange={(carcass) => set({ carcass })} /></div>
        <div className="border-t border-line pt-5"><h2 className="mb-3 text-2xl">חזיתות</h2><MaterialForm kind="fronts" value={d.fronts} carcass={d.carcass} onChange={(fronts) => set({ fronts })} /></div>
      </section>

      <section className="panel grid gap-4 p-5">
        <Field label="הערות לתכנון" id="notes"><textarea id="notes" rows={4} className="field" value={d.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {withFiles && (
          <div>
            <span className="label">תוכניות וקבצים</span>
            <label className="btn-ghost cursor-pointer">
              <Paperclip className="h-4 w-4" aria-hidden />צירוף קבצים
              <input type="file" multiple className="sr-only" onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
            </label>
            {files.length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{f.name}</span><span className="num text-steel">{(f.size / 1048576).toFixed(1)} MB</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`הסרת ${f.name}`} className="rounded p-1 hover:bg-sheet"><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {err && <p role="alert" className="font-semibold text-red-700">{err}</p>}
      <div className="flex gap-3">
        <button className="btn-cut px-8 py-3 text-lg" disabled={busy}>{busy ? "שומר…" : saveLabel}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>ביטול</button>}
      </div>
    </form>
  );
}
