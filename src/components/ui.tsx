import { Navigate, useNavigate } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Logo, NavItem } from "./Site";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { STATUS, FLOW, flowIndex } from "@/lib/status";
import type { OrderStatus } from "@/lib/types";

export function AppShell({ admin = false, children, title }: { admin?: boolean; children: ReactNode; title: string }) {
  const { me, loading } = useApp();
  const nav = useNavigate();
  useEffect(() => { document.title = `${title} – TimberCad`; }, [title]);
  if (loading) return <div className="grid min-h-screen place-items-center text-steel" role="status">טוען…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (admin && me.role !== "admin") return <Navigate to="/portal" replace />;
  return (
    <div className="min-h-screen">
      <header className="bg-slate">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Logo light />
          <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="ניווט באזור האישי">
            {admin ? (<>
              <NavItem to="/admin" end>הזמנות</NavItem>
              <NavItem to="/admin/clients">לקוחות</NavItem>
              <NavItem to="/admin/catalog">קטלוג</NavItem>
              <NavItem to="/portal" end>תצוגת לקוח</NavItem>
            </>) : (<>
              <NavItem to="/portal" end>ההזמנות שלי</NavItem>
              <NavItem to="/portal/new">הזמנה חדשה</NavItem>
              <NavItem to="/portal/settings">הסטנדרט שלי</NavItem>
              {me.role === "admin" && <NavItem to="/admin">ניהול</NavItem>}
            </>)}
          </nav>
          <div className="flex items-center gap-3 text-sm text-white/80">
            <span className="hidden sm:inline">{me.company_name || me.full_name}</span>
            <button onClick={async () => { await api.signOut(); nav("/"); }} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-white/10" aria-label="יציאה">
              <LogOut className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">יציאה</span>
            </button>
          </div>
        </div>
      </header>
      {api.demo && <div className="bg-warn/15 px-5 py-1.5 text-center text-sm">מצב הדגמה: הנתונים נשמרים רק בדפדפן הזה.</div>}
      <main id="main" className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}

const TONE: Record<string, string> = {
  info: "bg-info/10 text-info", work: "bg-cut/10 text-cut-ink", warn: "bg-warn/15 text-warn",
  ok: "bg-ok/10 text-ok", muted: "bg-steel/10 text-steel",
};
export function StatusBadge({ status, admin }: { status: OrderStatus; admin?: boolean }) {
  const s = STATUS[status];
  const label = !admin && status === "billing" ? STATUS.done.label : s.label;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ${TONE[s.tone]}`}>{label}</span>;
}

export function StatusLine({ status }: { status: OrderStatus }) {
  const idx = flowIndex(status);
  if (status === "cancelled") return <p className="text-steel">ההזמנה בוטלה.</p>;
  return (
    <ol className="flex items-center gap-0" aria-label="התקדמות ההזמנה">
      {FLOW.map((s, i) => {
        const done = i < idx, cur = i === idx;
        const frozenHere = cur && status === "frozen";
        return (
          <li key={s} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={cur ? "step" : undefined}>
            <span className={`grid h-8 w-8 flex-none place-items-center rounded-full border-2 text-sm font-bold
              ${frozenHere ? "border-warn bg-warn text-white" : cur ? "border-cut bg-cut text-white" : done ? "border-slate bg-slate text-white" : "border-line bg-white text-steel"}`}>
              {done ? "✓" : frozenHere ? "❚❚" : i + 1}
            </span>
            <span className={`whitespace-nowrap text-sm ${cur ? "font-bold" : "text-steel"}`}>{frozenHere ? STATUS.frozen.label : STATUS[s].label}</span>
            {i < FLOW.length - 1 && <span className={`mx-2 h-0.5 flex-1 ${done ? "bg-slate" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

export function Field({ label, children, hint, id }: { label: string; children: ReactNode; hint?: string; id?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-sm text-steel">{hint}</p>}
    </div>
  );
}

export function Choice({ options, value, onChange, name, disabled }:
  { options: { key: string; label: string }[]; value?: string; onChange: (v: string) => void; name: string; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key} disabled={disabled}
          onClick={() => onChange(o.key)}
          className={`rounded-lg border px-3.5 py-2 text-[0.95rem] transition-colors disabled:cursor-default
            ${value === o.key ? "border-slate bg-slate text-white" : "border-line bg-white hover:border-steel disabled:hover:border-line"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center"><h2 className="text-2xl">{title}</h2><div className="mt-3 text-steel">{children}</div></div>;
}

export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" }) : "");
export const fmtDateTime = (s: string) => new Date(s).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
