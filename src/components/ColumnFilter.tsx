import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Filter } from "lucide-react";

export interface FilterValue { value: string; label: string; count: number }

/** Excel-style column header: sort, search and pick values from a checklist. */
export function ColumnFilter({ label, values, selected, onChange, sortDir, onSort }: {
  label: string;
  values: FilterValue[];
  selected: Set<string> | null;               // null = everything (no filter)
  onChange: (s: Set<string> | null) => void;
  sortDir: 1 | -1 | 0;
  onSort: (dir: 1 | -1) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const active = selected !== null;

  useEffect(() => {
    if (!open) return;
    setDraft(new Set(selected ?? values.map((v) => v.value))); setQ("");
    // the table scrolls sideways (overflow), so the menu is placed on the page, under the header button
    const r = btn.current!.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, Math.min(window.innerWidth - r.right, window.innerWidth - 264)) });
    const onScroll = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("scroll", onScroll, true); window.addEventListener("resize", onScroll);
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = useMemo(() => values.filter((v) => !q || v.label.toLowerCase().includes(q.toLowerCase())), [values, q]);
  const allShown = shown.length > 0 && shown.every((v) => draft.has(v.value));
  const toggle = (v: string) => setDraft((d) => { const n = new Set(d); n.has(v) ? n.delete(v) : n.add(v); return n; });
  const apply = () => {
    const sel = q ? new Set(shown.filter((v) => draft.has(v.value)).map((v) => v.value)) : draft;
    onChange(sel.size === values.length && !q ? null : sel); setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={box}>
      <button ref={btn} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-semibold hover:bg-white ${active ? "text-cut-ink" : ""}`}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
        {sortDir === 1 ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : sortDir === -1 ? <ArrowDown className="h-3.5 w-3.5" aria-hidden /> : null}
        {active ? <Filter className="h-3.5 w-3.5 fill-current" aria-label="מסונן" /> : <ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden />}
      </button>
      {open && (
        <div role="dialog" aria-label={`סינון ${label}`} style={{ top: pos.top, right: pos.right }} className="fixed z-50 grid w-64 gap-2 rounded-xl border border-line bg-white p-3 text-sm font-normal text-slate shadow-lg">
          <div className="grid gap-1 border-b border-line pb-2">
            <button className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-right hover:bg-sheet ${sortDir === 1 ? "font-semibold" : ""}`} onClick={() => { onSort(1); setOpen(false); }}><ArrowUp className="h-4 w-4" aria-hidden />מיון מהקטן לגדול</button>
            <button className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-right hover:bg-sheet ${sortDir === -1 ? "font-semibold" : ""}`} onClick={() => { onSort(-1); setOpen(false); }}><ArrowDown className="h-4 w-4" aria-hidden />מיון מהגדול לקטן</button>
          </div>
          <input className="field py-1.5" placeholder="חיפוש" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`חיפוש בעמודה ${label}`} autoFocus />
          <div className="max-h-60 overflow-y-auto rounded-md border border-line">
            <label className="flex cursor-pointer items-center gap-2 border-b border-line bg-sheet px-2 py-1.5 font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-slate" checked={allShown}
                onChange={() => setDraft((d) => { const n = new Set(d); shown.forEach((v) => (allShown ? n.delete(v.value) : n.add(v.value))); return n; })} />
              בחירת הכל
            </label>
            {shown.map((v) => (
              <label key={v.value} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-sheet">
                <input type="checkbox" className="h-4 w-4 accent-slate" checked={draft.has(v.value)} onChange={() => toggle(v.value)} />
                <span className="flex-1 truncate" dir="auto">{v.label}</span><span className="num text-xs text-steel">{v.count}</span>
              </label>
            ))}
            {!shown.length && <p className="p-2 text-steel">אין ערכים</p>}
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1 py-1.5" onClick={apply} disabled={!draft.size}>אישור</button>
            {active && <button className="btn-ghost py-1.5" onClick={() => { onChange(null); setOpen(false); }}>ניקוי</button>}
          </div>
        </div>
      )}
    </div>
  );
}
