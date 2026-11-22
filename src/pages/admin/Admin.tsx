import { Link, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { Download, Search, Plus, Eye, EyeOff, Pencil, Trash2, Check, X } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell, Empty, StatusBadge, fmtDate } from "@/components/ui";
import { HardwareForm, useSpecText } from "@/components/SpecForms";
import { OrderEditor, type Draft } from "@/components/OrderEditor";
import { api } from "@/lib/api";
import { useApp, useAsync } from "@/lib/store";
import { ADMIN_STATUSES, STATUS } from "@/lib/status";
import { CATEGORIES } from "@/lib/catalog-seed";
import type { Order, OrderStatus, Profile } from "@/lib/types";

const TABS: { key: string; label: string; match: (s: OrderStatus) => boolean }[] = [
  { key: "open", label: "פתוחות", match: (s) => ["submitted", "production", "frozen"].includes(s) },
  { key: "submitted", label: "חדשות", match: (s) => s === "submitted" },
  { key: "production", label: "בייצור", match: (s) => s === "production" },
  { key: "frozen", label: "מוקפאות", match: (s) => s === "frozen" },
  { key: "billing", label: "לחיוב", match: (s) => s === "done" || s === "billing" },
  { key: "billed", label: "ארכיון", match: (s) => s === "billed" || s === "cancelled" },
  { key: "all", label: "הכל", match: () => true },
];

function BulkStatusBar({ ids, onDone, onClear }: { ids: string[]; onDone: () => void; onClear: () => void }) {
  const [to, setTo] = useState<OrderStatus>("billing");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const apply = async (status: OrderStatus) => {
    setBusy(true); setMsg("");
    try { for (const id of ids) await api.updateOrder(id, { status }); setMsg(`${ids.length} הזמנות עודכנו ל"${STATUS[status].label}"`); onClear(); onDone(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className={`sticky top-0 z-30 mb-4 flex flex-wrap items-center gap-2 rounded-xl border p-3 ${ids.length ? "border-slate bg-white shadow-md" : "border-line bg-white/70"}`}>
      <span className="font-semibold">{ids.length ? `נבחרו ${ids.length} הזמנות` : "סמן הזמנות כדי לשנות סטטוס לכמה יחד"}</span>
      <span className="flex-1" />
      <button className="btn-ghost py-1.5" disabled={!ids.length || busy} onClick={() => apply("done")}>סימון כהושלמו</button>
      <button className="btn-primary py-1.5" disabled={!ids.length || busy} onClick={() => apply("billing")}>העברה לחיוב</button>
      <select className="field w-36 py-1.5" value={to} onChange={(e) => setTo(e.target.value as OrderStatus)} aria-label="סטטוס לעדכון" disabled={!ids.length}>
        {ADMIN_STATUSES.map((st) => <option key={st} value={st}>{STATUS[st].label}</option>)}
      </select>
      <button className="btn-ghost py-1.5" disabled={!ids.length || busy} onClick={() => apply(to)}>עדכון</button>
      {ids.length > 0 && <button className="btn-ghost py-1.5" onClick={onClear}>ניקוי בחירה</button>}
      {msg && <span role="status" className="w-full text-sm text-ok">{msg}</span>}
    </div>
  );
}

export function AdminOrders() {
  const { data: orders, reload, error } = useAsync(() => api.orders({ all: true }), []);
  const [tab, setTab] = useState("open");
  const [q, setQ] = useState("");
  const [client, setClient] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { hw, mat } = useSpecText();
  const clients = useMemo(() => {
    const m = new Map<string, string>();
    orders?.forEach((o) => m.set(o.user_id, o.client?.company_name || o.client?.full_name || o.client?.email || ""));
    return [...m].sort((a, b) => a[1].localeCompare(b[1], "he"));
  }, [orders]);
  const t = TABS.find((x) => x.key === tab)!;
  const list = (orders ?? []).filter((o) => t.match(o.status) && (!client || o.user_id === client) &&
    (!q || `${o.order_no} ${o.project_name} ${o.job_name} ${o.client?.company_name} ${o.client?.full_name}`.toLowerCase().includes(q.toLowerCase())));

  const quickStatus = async (o: Order, s: OrderStatus) => { await api.updateOrder(o.id, { status: s }); reload(); };
  const exportRows = () => list.map((o) => {
    const h = hw(o.hardware);
    return {
      "מספר": o.order_no, "פרויקט": o.project_name, "שם עבודה": o.job_name, "לקוח": o.client?.company_name || o.client?.full_name || "",
      "מייל": o.client?.email ?? "", "סטטוס": STATUS[o.status].label, "נפתחה": fmtDate(o.created_at), "עודכנה": fmtDate(o.updated_at),
      "לוחות": o.sheets_count ?? "", "שיטת חיבור": h.connection, "צירים": h.hinge, "מגירות": h.drawer,
      "גוף": mat(o.carcass), "חזיתות": mat(o.fronts, "fronts"), "הערות": o.notes, "הערות פנימיות": o.admin_notes,
    };
  });
  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows()); ws["!cols"] = Object.keys(exportRows()[0] ?? {}).map(() => ({ wch: 18 }));
    (ws as unknown as { "!dir"?: string })["!dir"] = "rtl";
    const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws, "הזמנות");
    XLSX.writeFile(wb, `timbercad-orders-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const exportCsv = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const blob = new Blob(["﻿" + XLSX.utils.sheet_to_csv(ws)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `timbercad-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };
  const count = (k: string) => (orders ?? []).filter((o) => TABS.find((x) => x.key === k)!.match(o.status)).length;

  return (
    <AppShell admin title="ניהול הזמנות">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <h1 className="flex-1 text-3xl">הזמנות</h1>
        <button className="btn-ghost" onClick={exportXlsx} disabled={!list.length}><Download className="h-4 w-4" aria-hidden />ייצוא לאקסל</button>
        <button className="btn-ghost" onClick={exportCsv} disabled={!list.length}>CSV</button>
        <Link to="/admin/new" className="btn-cut"><Plus className="h-4 w-4" aria-hidden />הזמנה ללקוח</Link>
      </div>
      {count("frozen") > 0 && tab !== "frozen" && (
        <button onClick={() => setTab("frozen")} className="mb-4 w-full rounded-xl border border-warn/40 bg-warn/10 p-3 text-right font-semibold text-warn">
          {count("frozen")} הזמנות הוקפאו על ידי לקוחות. לחץ לצפייה
        </button>
      )}
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="סינון לפי מצב">
        {TABS.map((x) => (
          <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${tab === x.key ? "border-slate bg-slate text-white" : "border-line bg-white"}`}>
            {x.label} <span className="num opacity-70">{count(x.key)}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute right-3 top-3 h-5 w-5 text-steel" aria-hidden />
          <input className="field pr-10" placeholder="חיפוש לפי מספר, פרויקט או לקוח" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש הזמנות" />
        </div>
        <select className="field w-60" value={client} onChange={(e) => setClient(e.target.value)} aria-label="סינון לפי לקוח">
          <option value="">כל הלקוחות</option>{clients.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <BulkStatusBar ids={[...sel].filter((id) => list.some((o) => o.id === id))} onDone={reload} onClear={() => setSel(new Set())} />
      {orders && list.length === 0 ? <Empty title="אין הזמנות בתצוגה הזו">נסה לשנות את הסינון.</Empty> : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[820px] text-right">
            <thead className="border-b border-line bg-sheet text-sm text-steel">
              <tr><th className="w-10 p-3"><input type="checkbox" className="h-4 w-4 accent-slate" aria-label="בחירת כל ההזמנות בתצוגה"
                checked={list.length > 0 && list.every((o) => sel.has(o.id))}
                onChange={(e) => setSel(e.target.checked ? new Set(list.map((o) => o.id)) : new Set())} /></th><th className="p-3">#</th><th className="p-3">פרויקט</th><th className="p-3">לקוח</th><th className="p-3">נפתחה</th><th className="p-3">לוחות</th><th className="p-3">סטטוס</th><th className="p-3">שינוי סטטוס</th></tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className={`border-b border-line last:border-0 hover:bg-sheet/60 ${sel.has(o.id) ? "bg-info/8" : o.status === "frozen" ? "bg-warn/5" : ""}`}>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 accent-slate" checked={sel.has(o.id)} aria-label={`בחירת הזמנה ${o.order_no}`}
                    onChange={() => setSel((s0) => { const s1 = new Set(s0); s1.has(o.id) ? s1.delete(o.id) : s1.add(o.id); return s1; })} /></td>
                  <td className="num p-3 text-steel">{o.order_no}</td>
                  <td className="p-3"><Link to={`/admin/order/${o.id}`} className="font-semibold text-slate underline-offset-2 hover:underline">{o.project_name}</Link>
                    {o.job_name && o.job_name !== o.project_name && <div className="text-sm text-steel" dir="auto">{o.job_name}</div>}</td>
                  <td className="p-3">{o.client?.company_name || o.client?.full_name}</td>
                  <td className="num p-3 text-steel">{fmtDate(o.created_at)}</td>
                  <td className="num p-3">{o.sheets_count ?? "–"}</td>
                  <td className="p-3"><StatusBadge status={o.status} admin /></td>
                  <td className="p-3">
                    <select className="field py-1.5 text-sm" value={o.status} onChange={(e) => quickStatus(o, e.target.value as OrderStatus)} aria-label={`סטטוס הזמנה ${o.order_no}`}>
                      {ADMIN_STATUSES.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

export function AdminNewOrder() {
  const nav = useNavigate();
  const { data: clients } = useAsync(() => api.clients(), []);
  const [uid, setUid] = useState("");
  const [busy, setBusy] = useState(false);
  const c = clients?.find((x) => x.id === uid);
  return (
    <AppShell admin title="הזמנה ללקוח">
      <h1 className="mb-5 text-3xl">הזמנה חדשה עבור לקוח</h1>
      <div className="panel mb-6 max-w-md p-5">
        <label className="label" htmlFor="pick">לקוח</label>
        <select id="pick" className="field" value={uid} onChange={(e) => setUid(e.target.value)}>
          <option value="">בחר לקוח</option>
          {clients?.filter((x) => x.role === "client").map((x) => <option key={x.id} value={x.id}>{x.company_name || x.full_name} ({x.email})</option>)}
        </select>
      </div>
      {c && <OrderEditor key={c.id} saveLabel="יצירת ההזמנה" busy={busy} fromDefaults={false}
        initial={{ project_name: "", hardware: JSON.parse(JSON.stringify(c.defaults)), carcass: {}, fronts: { same_as_carcass: false }, notes: "" } as Draft}
        onSave={async (d) => { setBusy(true); const o = await api.createOrder({ ...d, user_id: c.id }); nav(`/admin/order/${o.id}`); }} />}
    </AppShell>
  );
}

export function AdminClients() {
  const { data: clients } = useAsync(() => api.clients(), []);
  const { data: orders } = useAsync(() => api.orders({ all: true }), []);
  const [q, setQ] = useState("");
  const list = (clients ?? []).filter((c) => !q || `${c.company_name} ${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const stats = (id: string) => {
    const os = orders?.filter((o) => o.user_id === id) ?? [];
    return { total: os.length, open: os.filter((o) => ["submitted", "production", "frozen"].includes(o.status)).length };
  };
  return (
    <AppShell admin title="לקוחות">
      <div className="mb-5 flex flex-wrap items-end gap-3"><h1 className="flex-1 text-3xl">לקוחות</h1>
        <input className="field w-72" placeholder="חיפוש לקוח" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש לקוח" /></div>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[700px] text-right">
          <thead className="border-b border-line bg-sheet text-sm text-steel"><tr><th className="p-3">עסק</th><th className="p-3">איש קשר</th><th className="p-3">מייל</th><th className="p-3">טלפון</th><th className="p-3">הזמנות פתוחות</th><th className="p-3">סה״כ</th></tr></thead>
          <tbody>{list.map((c) => { const s = stats(c.id); return (
            <tr key={c.id} className="border-b border-line last:border-0 hover:bg-sheet/60">
              <td className="p-3"><Link to={`/admin/clients/${c.id}`} className="font-semibold hover:underline">{c.company_name || "—"}</Link>{c.role === "admin" && <span className="mr-2 rounded bg-slate px-1.5 text-xs text-white">מנהל</span>}</td>
              <td className="p-3">{c.full_name}</td><td className="p-3" dir="ltr">{c.email}</td><td className="p-3" dir="ltr">{c.phone}</td>
              <td className="num p-3">{s.open}</td><td className="num p-3">{s.total}</td>
            </tr>); })}</tbody>
        </table>
      </div>
    </AppShell>
  );
}

export function AdminClient() {
  const { id = "" } = useParams();
  const { data: clients, reload } = useAsync(() => api.clients(), [id]);
  const { data: orders, reload: reloadOrders } = useAsync(() => api.orders({ all: true }), [id]);
  const [osel, setOsel] = useState<Set<string>>(new Set());
  const c = clients?.find((x) => x.id === id);
  const [f, setF] = useState<Profile | null>(null);
  const [msg, setMsg] = useState("");
  const cur = f ?? c ?? null;
  if (!cur) return <AppShell admin title="לקוח"><p className="text-steel">טוען…</p></AppShell>;
  const set = (p: Partial<Profile>) => setF({ ...cur, ...p });
  const save = async () => {
    const { full_name, company_name, phone, defaults, notes, drive_folder, role } = cur;
    try { await api.updateProfile(id, { full_name, company_name, phone, defaults, notes, drive_folder, role }); setMsg("נשמר"); setF(null); reload(); } catch (e) { setMsg((e as Error).message); }
  };
  const mine = orders?.filter((o) => o.user_id === id) ?? [];
  return (
    <AppShell admin title={cur.company_name || cur.full_name}>
      <p className="mb-2 text-sm"><Link to="/admin/clients" className="text-info underline">כל הלקוחות</Link></p>
      <h1 className="mb-6 text-3xl">{cur.company_name || cur.full_name}</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
        <div className="grid content-start gap-6">
          <section className="panel grid gap-4 p-5 sm:grid-cols-2">
            {([["full_name", "שם איש קשר"], ["company_name", "שם העסק"], ["phone", "טלפון"], ["drive_folder", "תיקיית לקוח בדרייב"]] as const).map(([k, l]) => (
              <div key={k}><label className="label" htmlFor={`c-${k}`}>{l}</label><input id={`c-${k}`} className="field" dir="auto" value={cur[k]} onChange={(e) => set({ [k]: e.target.value })} /></div>
            ))}
            <div><span className="label">מייל</span><div className="py-2.5" dir="ltr">{cur.email}</div></div>
            <div><label className="label" htmlFor="c-role">הרשאה</label>
              <select id="c-role" className="field" value={cur.role} onChange={(e) => set({ role: e.target.value as Profile["role"] })}><option value="client">לקוח</option><option value="admin">מנהל</option></select></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="c-notes">הערות פנימיות</label><textarea id="c-notes" rows={3} className="field" value={cur.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
          </section>
          <section className="panel p-5"><h2 className="mb-4 text-2xl">הסטנדרט של הלקוח</h2><HardwareForm value={cur.defaults ?? { hinge: {}, drawer: {} }} onChange={(defaults) => set({ defaults })} /></section>
          <div className="flex items-center gap-3"><button className="btn-cut px-8" onClick={save}>שמירה</button>{msg && <span role="status">{msg}</span>}</div>
        </div>
        <aside className="content-start">
          <BulkStatusBar ids={[...osel]} onDone={reloadOrders} onClear={() => setOsel(new Set())} />
          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-slate" aria-label="בחירת כל ההזמנות של הלקוח"
                checked={mine.length > 0 && mine.every((o) => osel.has(o.id))} onChange={(e) => setOsel(e.target.checked ? new Set(mine.map((o) => o.id)) : new Set())} />
              <h2 className="text-xl">הזמנות ({mine.length})</h2>
            </div>
            <ul className="grid gap-1">{mine.map((o) => (
              <li key={o.id} className={`flex items-center gap-2 rounded-lg px-2 ${osel.has(o.id) ? "bg-info/8" : ""}`}>
                <input type="checkbox" className="h-4 w-4 accent-slate" checked={osel.has(o.id)} aria-label={`בחירת הזמנה ${o.order_no}`}
                  onChange={() => setOsel((s0) => { const s1 = new Set(s0); s1.has(o.id) ? s1.delete(o.id) : s1.add(o.id); return s1; })} />
                <Link to={`/admin/order/${o.id}`} className="flex flex-1 items-center gap-2 rounded-lg py-2 hover:underline">
                  <span className="num text-steel">#{o.order_no}</span><span className="flex-1">{o.project_name}</span><StatusBadge status={o.status} admin /></Link></li>))}</ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

export function AdminCatalog() {
  const { catalog, reloadCatalog } = useApp();
  const [add, setAdd] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true); setMsg("");
    try { await fn(); await reloadCatalog(); if (done) setMsg(done); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const toggle = (id: string) => setSel((s0) => { const s1 = new Set(s0); s1.has(id) ? s1.delete(id) : s1.add(id); return s1; });
  const selected = catalog.filter((c) => sel.has(c.id));
  const setActive = (items: typeof catalog, active: boolean) =>
    run(() => api.saveCatalogItems(items.map((c) => ({ ...c, active }))), active ? "האפשרויות מוצגות" : "האפשרויות הוסתרו");
  const saveLabel = () => {
    if (!editing) return;
    const item = catalog.find((c) => c.id === editing.id); const label = editing.label.trim();
    setEditing(null);
    if (item && label && label !== item.label) run(() => api.saveCatalogItem({ ...item, label }), "השם עודכן");
  };
  const cats = Object.entries(CATEGORIES).filter(([k]) => k !== "drawer_model");
  return (
    <AppShell admin title="קטלוג">
      <h1 className="text-3xl">קטלוג אפשרויות</h1>
      <p className="mb-4 mt-1 max-w-2xl text-steel">האפשרויות שהלקוחות רואים בהזמנה. אפשרות מוסתרת לא מופיעה בהזמנות חדשות, אבל נשמרת בהזמנות ישנות.</p>

      <div className={`sticky top-0 z-30 mb-5 flex flex-wrap items-center gap-2 rounded-xl border p-3 ${sel.size ? "border-slate bg-white shadow-md" : "border-line bg-white/70"}`}>
        <span className="font-semibold">{sel.size ? `נבחרו ${sel.size}` : "סמן אפשרויות כדי לפעול על כמה יחד"}</span>
        <span className="flex-1" />
        <button className="btn-ghost py-1.5" disabled={!sel.size || busy} onClick={() => setActive(selected, false)}><EyeOff className="h-4 w-4" aria-hidden />הסתרה</button>
        <button className="btn-ghost py-1.5" disabled={!sel.size || busy} onClick={() => setActive(selected, true)}><Eye className="h-4 w-4" aria-hidden />הצגה</button>
        <button className="btn-danger py-1.5" disabled={!sel.size || busy} onClick={() => setConfirmDel([...sel])}><Trash2 className="h-4 w-4" aria-hidden />מחיקה</button>
        {sel.size > 0 && <button className="btn-ghost py-1.5" onClick={() => setSel(new Set())}>ניקוי בחירה</button>}
        {msg && <span role="status" className="w-full text-sm text-ok">{msg}</span>}
      </div>

      {confirmDel && (
        <div role="alertdialog" aria-label="אישור מחיקה" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold">למחוק {confirmDel.length === 1 ? `את "${catalog.find((c) => c.id === confirmDel[0])?.label}"` : `${confirmDel.length} אפשרויות`}?</p>
          <p className="mt-1 text-sm text-steel">הזמנות ישנות שבחרו אפשרות שנמחקה יציגו את המזהה הפנימי שלה במקום השם. אם רוצים רק שלא תופיע ללקוחות, עדיף להסתיר.</p>
          <div className="mt-3 flex gap-2">
            <button className="btn-danger" autoFocus disabled={busy} onClick={() => run(async () => { await api.deleteCatalogItems(confirmDel); setSel(new Set()); setConfirmDel(null); }, "נמחק")}>מחיקה</button>
            <button className="btn-ghost" onClick={() => setConfirmDel(null)}>ביטול</button>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cats.map(([cat, title]) => {
          const items = catalog.filter((c) => c.category === cat).sort((a, b) => a.sort - b.sort);
          const allSel = items.length > 0 && items.every((c) => sel.has(c.id));
          return (
            <section key={cat} className="panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-slate" checked={allSel} aria-label={`בחירת כל האפשרויות ב${title}`}
                  onChange={() => setSel((s0) => { const s1 = new Set(s0); items.forEach((c) => (allSel ? s1.delete(c.id) : s1.add(c.id))); return s1; })} />
                <h2 className="text-xl">{title}</h2>
              </div>
              <ul className="grid gap-0.5">
                {items.map((c) => (
                  <li key={c.id} className={`flex items-center gap-2 rounded-md px-2 py-1 ${sel.has(c.id) ? "bg-info/8" : ""}`}>
                    <input type="checkbox" className="h-4 w-4 accent-slate" checked={sel.has(c.id)} onChange={() => toggle(c.id)} aria-label={`בחירת ${c.label}`} />
                    {editing?.id === c.id ? (
                      <form className="flex flex-1 gap-1" onSubmit={(e) => { e.preventDefault(); saveLabel(); }}>
                        <input autoFocus className="field py-1" value={editing.label} aria-label="שם האפשרות"
                          onChange={(e) => setEditing({ ...editing, label: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setEditing(null)} />
                        <button className="rounded p-1.5 hover:bg-sheet" aria-label="שמירת השם"><Check className="h-4 w-4 text-ok" /></button>
                        <button type="button" className="rounded p-1.5 hover:bg-sheet" onClick={() => setEditing(null)} aria-label="ביטול עריכה"><X className="h-4 w-4" /></button>
                      </form>
                    ) : (<>
                      <span className={`flex-1 ${c.active ? "" : "text-steel line-through"}`}>{c.label}</span>
                      <button className="rounded p-1 hover:bg-sheet" onClick={() => setEditing({ id: c.id, label: c.label })} aria-label={`עריכת ${c.label}`} title="עריכה"><Pencil className="h-4 w-4" /></button>
                      <button className="rounded p-1 hover:bg-sheet" onClick={() => run(() => api.saveCatalogItem({ ...c, active: !c.active }))}
                        aria-label={c.active ? `הסתרת ${c.label}` : `הצגת ${c.label}`} title={c.active ? "הסתרה" : "הצגה"}>
                        {c.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                      <button className="rounded p-1 text-red-700 hover:bg-red-50" onClick={() => setConfirmDel([c.id])} aria-label={`מחיקת ${c.label}`} title="מחיקה"><Trash2 className="h-4 w-4" /></button>
                    </>)}
                  </li>
                ))}
              </ul>
              <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); const label = add[cat]?.trim(); if (!label) return;
                await run(() => api.saveCatalogItem({ category: cat, key: label.toLowerCase().replace(/\s+/g, "_"), label, parent: null, sort: 900, active: true })); setAdd({ ...add, [cat]: "" }); }}>
                <input className="field py-1.5" placeholder="אפשרות חדשה" value={add[cat] ?? ""} onChange={(e) => setAdd({ ...add, [cat]: e.target.value })} aria-label={`הוספה ל${title}`} />
                <button className="btn-ghost py-1.5">הוספה</button>
              </form>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
