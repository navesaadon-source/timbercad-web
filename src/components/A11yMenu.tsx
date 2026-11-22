import { useEffect, useRef, useState } from "react";
import { Accessibility, X } from "lucide-react";
import { Link } from "react-router-dom";

const TOGGLES: [cls: string, label: string][] = [
  ["a11y-contrast", "ניגודיות גבוהה"],
  ["a11y-links", "הדגשת קישורים"],
  ["a11y-readable", "גופן קריא"],
  ["a11y-spacing", "ריווח שורות"],
  ["a11y-grayscale", "גווני אפור"],
  ["a11y-cursor", "סמן גדול"],
  ["a11y-no-motion", "עצירת אנימציות"],
];
const KEY = "tc-a11y";

function apply(state: { size: number; on: string[] }) {
  const h = document.documentElement;
  [1, 2, 3].forEach((n) => h.classList.toggle(`a11y-text-${n}`, state.size === n));
  TOGGLES.forEach(([c]) => h.classList.toggle(c, state.on.includes(c)));
}

export default function A11yMenu() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ size: number; on: string[] }>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "") ; } catch { return { size: 0, on: [] }; }
  });
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { apply(state); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", esc); return () => removeEventListener("keydown", esc);
  }, [open]);
  const toggle = (c: string) => setState((s) => ({ ...s, on: s.on.includes(c) ? s.on.filter((x) => x !== c) : [...s.on, c] }));

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="a11y-panel"
        className="fixed bottom-5 left-5 z-50 grid h-13 w-13 place-items-center rounded-full bg-info text-white shadow-lg hover:brightness-110"
        aria-label="תפריט נגישות" title="נגישות">
        <Accessibility className="h-7 w-7" aria-hidden />
      </button>
      {open && (
        <div id="a11y-panel" ref={panel} role="dialog" aria-label="הגדרות נגישות"
          className="fixed bottom-22 left-5 z-50 w-72 rounded-xl border border-line bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">נגישות</h2>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-sheet" aria-label="סגירת תפריט הנגישות"><X className="h-5 w-5" /></button>
          </div>
          <div className="mb-3">
            <div className="label">גודל טקסט</div>
            <div className="flex gap-1.5" role="group" aria-label="גודל טקסט">
              {["רגיל", "גדול", "גדול יותר", "הכי גדול"].map((t, i) => (
                <button key={t} onClick={() => setState((s) => ({ ...s, size: i }))} aria-pressed={state.size === i}
                  className={`flex-1 rounded-md border px-1 py-1.5 text-sm ${state.size === i ? "border-slate bg-slate text-white" : "border-line"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {TOGGLES.map(([c, t]) => (
              <button key={c} onClick={() => toggle(c)} aria-pressed={state.on.includes(c)}
                className={`rounded-md border px-2 py-2 text-sm ${state.on.includes(c) ? "border-slate bg-slate text-white" : "border-line hover:bg-sheet"}`}>{t}</button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <button onClick={() => setState({ size: 0, on: [] })} className="font-semibold text-info underline">איפוס</button>
            <Link to="/accessibility" onClick={() => setOpen(false)} className="text-info underline">הצהרת נגישות</Link>
          </div>
        </div>
      )}
    </>
  );
}
