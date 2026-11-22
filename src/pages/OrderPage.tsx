import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { Pause, Play, Pencil, ExternalLink, FileText, Trash2, LayoutGrid } from "lucide-react";
import { AppShell, StatusBadge, StatusLine, fmtDate, fmtDateTime } from "@/components/ui";
import { SpecSummary } from "@/components/SpecForms";
import { OrderEditor, type Draft } from "@/components/OrderEditor";
import { api } from "@/lib/api";
import { useApp, useAsync } from "@/lib/store";
import { ADMIN_STATUSES, STATUS, clientCanCancel, clientCanEdit, clientCanFreeze, clientCanResume } from "@/lib/status";
import type { Order, OrderStatus } from "@/lib/types";

export default function OrderPage({ admin = false }: { admin?: boolean }) {
  const { id = "" } = useParams();
  const { me } = useApp();
  const nav = useNavigate();
  const { data: o, error, reload } = useAsync(() => api.order(id), [id]);
  const { data: events, reload: reloadEv } = useAsync(() => api.events(id), [id]);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"" | "freeze" | "cancel" | "delete">("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const isAdmin = admin && me?.role === "admin";
  const base = isAdmin ? "/admin" : "/portal";

  const act = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true); setMsg("");
    try { await fn(); setConfirm(""); reload(); reloadEv(); if (done) setMsg(done); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const setStatus = (status: OrderStatus, done?: string) => act(() => api.updateOrder(id, { status }), done);

  if (error) return <AppShell admin={admin} title="הזמנה"><p role="alert" className="text-red-700">{error}</p></AppShell>;
  if (!o) return <AppShell admin={admin} title="הזמנה"><p role="status" className="text-steel">טוען…</p></AppShell>;
  const editable = isAdmin || clientCanEdit(o.status);

  return (
    <AppShell admin={admin} title={`#${o.order_no} ${o.project_name}`}>
      <p className="mb-2 text-sm"><Link to={base} className="text-info underline">{isAdmin ? "כל ההזמנות" : "ההזמנות שלי"}</Link></p>
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-3xl"><span className="num text-steel">#{o.order_no}</span> {o.project_name}</h1>
        <StatusBadge status={o.status} admin={isAdmin} />
        {isAdmin && o.client && <Link to={`/admin/clients/${o.user_id}`} className="text-info underline">{o.client.company_name || o.client.full_name}</Link>}
        <span className="mr-auto text-sm text-steel">נפתחה {fmtDate(o.created_at)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid content-start gap-6">
          <section className="panel p-5">
            <StatusLine status={o.status} />
            <p className="mt-4 text-steel">{statusHelp(o, isAdmin)}</p>
            {!isAdmin && (
              <div className="mt-4 flex flex-wrap gap-2">
                {clientCanEdit(o.status) && !editing && <button className="btn-ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden />עריכת ההזמנה</button>}
                {clientCanFreeze(o.status) && <button className="btn-ghost border-warn/50 text-warn" onClick={() => setConfirm("freeze")}><Pause className="h-4 w-4" aria-hidden />הקפאת העבודה</button>}
                {clientCanResume(o.status) && <button className="btn-primary" disabled={busy} onClick={() => setStatus("production", "ביקשת להמשיך את העבודה. קיבלנו התראה.")}><Play className="h-4 w-4" aria-hidden />המשך העבודה</button>}
                {clientCanCancel(o.status) && !editing && <button className="btn-danger" onClick={() => setConfirm("cancel")}>ביטול ההזמנה</button>}
              </div>
            )}
            {confirm === "freeze" && (
              <Confirm busy={busy} onNo={() => setConfirm("")} yes="הקפאה" onYes={() => setStatus("frozen", "העבודה הוקפאה. נווה קיבל התראה ויחזור אליך.")}>
                נעצור את העבודה על ההזמנה עד שתבקש להמשיך. נשלחת התראה מיידית.
              </Confirm>
            )}
            {confirm === "cancel" && (
              <Confirm busy={busy} onNo={() => setConfirm("")} yes="ביטול ההזמנה" danger onYes={() => setStatus("cancelled", "ההזמנה בוטלה.")}>לבטל את ההזמנה? אי אפשר לבטל את הפעולה.</Confirm>
            )}
            {msg && <p role="status" className="mt-3 font-semibold">{msg}</p>}
          </section>

          {o.hub_path && <HubCard order={o} />}

          {editing && editable ? (
            <OrderEditor
              initial={{ project_name: o.project_name, hardware: o.hardware, carcass: o.carcass, fronts: o.fronts, notes: o.notes } as Draft}
              saveLabel="שמירת השינויים" busy={busy} onCancel={() => setEditing(false)}
              onSave={(d) => act(async () => { await api.updateOrder(id, d); setEditing(false); }, "השינויים נשמרו.")} />
          ) : (
            <section className="panel p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl">פרטי ההזמנה</h2>
                {isAdmin && <button className="btn-ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden />עריכה</button>}</div>
              <SpecSummary hardware={o.hardware} carcass={o.carcass} fronts={o.fronts} />
              {o.notes && <div className="mt-5 border-t border-line pt-4"><h3 className="mb-1 text-lg">הערות</h3><p className="whitespace-pre-line">{o.notes}</p></div>}
            </section>
          )}

          {o.attachments.length > 0 && (
            <section className="panel p-5">
              <h2 className="mb-3 text-2xl">קבצים מצורפים</h2>
              <ul className="grid gap-2">
                {o.attachments.map((a) => (
                  <li key={a.path}><button className="inline-flex items-center gap-2 text-info underline"
                    onClick={async () => window.open(await api.fileUrl(a.path), "_blank", "noopener")}><FileText className="h-4 w-4" aria-hidden />{a.name}</button></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="grid content-start gap-6">
          {isAdmin && <AdminBox order={o} busy={busy} onStatus={(s) => setStatus(s, "הסטטוס עודכן.")}
            onSave={(p) => act(() => api.updateOrder(id, p), "נשמר.")} onDelete={() => setConfirm("delete")} />}
          {confirm === "delete" && (
            <div className="panel p-4"><Confirm busy={busy} danger yes="מחיקה לצמיתות" onNo={() => setConfirm("")}
              onYes={() => act(async () => { await api.deleteOrder(id); nav("/admin"); })}>למחוק את ההזמנה וכל ההיסטוריה שלה?</Confirm></div>
          )}
          <section className="panel p-5">
            <h2 className="mb-3 text-xl">היסטוריה</h2>
            <ol className="grid gap-3 border-r-2 border-line pr-4">
              {(events ?? []).map((e) => (
                <li key={e.id} className="text-sm"><div className="font-semibold">{eventText(e.kind, e.to_status)}</div><div className="num text-steel">{fmtDateTime(e.created_at)}</div></li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function statusHelp(o: Order, admin: boolean) {
  if (admin) return o.status === "frozen" && o.frozen_at ? `הלקוח הקפיא את העבודה ב-${fmtDateTime(o.frozen_at)}.` : STATUS[o.status].client;
  switch (o.status) {
    case "submitted": return "קיבלנו את ההזמנה. עד שהיא עוברת לייצור אפשר לערוך אותה או לבטל.";
    case "production": return "ההזמנה בייצור ואי אפשר לשנות אותה. אם משהו השתנה אצלך, הקפא את העבודה ונתאם.";
    case "frozen": return "העבודה מוקפאת. כשהכל מוכן, לחץ על \"המשך העבודה\".";
    case "done": case "billing": return "העבודה הושלמה. כל הקבצים מחכים לך במרכז העבודה.";
    default: return STATUS[o.status].client;
  }
}

function eventText(kind: string, to: OrderStatus | null) {
  if (kind === "created") return "ההזמנה נפתחה";
  if (kind === "edited") return "ההזמנה עודכנה";
  if (kind === "frozen") return "העבודה הוקפאה";
  if (kind === "unfrozen") return "העבודה חודשה";
  return to ? `סטטוס: ${STATUS[to].label}` : "עדכון";
}

function Confirm({ children, onYes, onNo, yes, busy, danger }: { children: React.ReactNode; onYes: () => void; onNo: () => void; yes: string; busy?: boolean; danger?: boolean }) {
  return (
    <div role="alertdialog" aria-label={yes} className="mt-4 rounded-lg border border-warn/40 bg-warn/5 p-4">
      <p>{children}</p>
      <div className="mt-3 flex gap-2">
        <button className={danger ? "btn-danger" : "btn-primary"} disabled={busy} onClick={onYes} autoFocus>{yes}</button>
        <button className="btn-ghost" onClick={onNo}>חזרה</button>
      </div>
    </div>
  );
}

function HubCard({ order }: { order: Order }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    const w = window.open("", "_blank");
    try {
      const html = await api.hubHtml(order.hub_path!);
      const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      if (w) w.location.href = url; else location.href = url;
    } catch (e) { w?.close(); alert((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl bg-slate p-5 text-white">
      <LayoutGrid className="h-9 w-9 text-ply" aria-hidden />
      <div className="flex-1"><h2 className="text-2xl">מרכז העבודה</h2><p className="text-white/75">פריסת פלטות ומדבקות, דוחות בנייה, פרזול, תוכניות וקבצי מכונה.</p></div>
      <button className="btn-cut" onClick={open} disabled={busy}><ExternalLink className="h-4 w-4" aria-hidden />{busy ? "פותח…" : "פתיחת מרכז העבודה"}</button>
    </section>
  );
}

function AdminBox({ order, onStatus, onSave, onDelete, busy }:
  { order: Order; onStatus: (s: OrderStatus) => void; onSave: (p: Partial<Order>) => void; onDelete: () => void; busy: boolean }) {
  const [f, setF] = useState({ job_name: order.job_name, sheets_count: order.sheets_count ?? "", admin_notes: order.admin_notes });
  return (
    <section className="panel grid gap-4 p-5">
      <h2 className="text-xl">ניהול</h2>
      <div>
        <label className="label" htmlFor="a-status">סטטוס</label>
        <select id="a-status" className="field" value={order.status} disabled={busy} onChange={(e) => onStatus(e.target.value as OrderStatus)}>
          {ADMIN_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
        <p className="mt-1 text-sm text-steel">הלקוח רואה את הסטטוס מיד.</p>
      </div>
      <div><label className="label" htmlFor="a-job">שם העבודה ב-iMOS</label><input id="a-job" dir="auto" className="field" value={f.job_name} onChange={(e) => setF({ ...f, job_name: e.target.value })} />
        <p className="mt-1 text-sm text-steel">השם של תיקיית העבודה ב-Imorder וב-CNC_FILES</p></div>
      <div><label className="label" htmlFor="a-sheets">מספר לוחות</label><input id="a-sheets" type="number" min={0} className="field num" value={f.sheets_count} onChange={(e) => setF({ ...f, sheets_count: e.target.value })} /></div>
      <div><label className="label" htmlFor="a-notes">הערות פנימיות</label><textarea id="a-notes" rows={3} className="field" value={f.admin_notes} onChange={(e) => setF({ ...f, admin_notes: e.target.value })} />
        <p className="mt-1 text-sm text-steel">הלקוח לא רואה את ההערות האלה</p></div>
      <button className="btn-primary" disabled={busy} onClick={() => onSave({ job_name: f.job_name.trim(), admin_notes: f.admin_notes, sheets_count: f.sheets_count === "" ? null : Number(f.sheets_count) })}>שמירה</button>
      <button className="btn-danger" onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden />מחיקת ההזמנה</button>
    </section>
  );
}
