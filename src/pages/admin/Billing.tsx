import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, Plus, Trash2, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/store";
import { VAT, ils, monthHours, monthKey, monthLabel, orderPrice } from "@/lib/billing";
import type { BillingRate, Order, OrderBilling, Profile, WorkHour } from "@/lib/types";

type Tab = "orders" | "hours" | "rates";
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const nameOf = (c?: Pick<Profile, "company_name" | "full_name" | "email">) => c?.company_name || c?.full_name || c?.email || "—";
const shiftMonth = (k: string, d: number) => { const [y, m] = k.split("-").map(Number); const t = new Date(y, m - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`; };

export function AdminBilling() {
  const [tab, setTab] = useState<Tab>("orders");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const from = `${month}-01`, to = `${shiftMonth(month, 1)}-01`;
  const { data, reload } = useAsync(async () => {
    const [orders, clients, rates, billing, hours] = await Promise.all([
      api.orders({ all: true }), api.clients(), api.rates(), api.orderBilling(), api.hours(from, to)]);
    return { orders, clients, rates, billing, hours };
  }, [month]);
  const rateOf = useMemo(() => new Map((data?.rates ?? []).map((r) => [r.user_id, r])), [data]);
  const billOf = useMemo(() => new Map((data?.billing ?? []).map((b) => [b.order_id, b])), [data]);

  const pending = (data?.orders ?? []).filter((o) => (o.status === "done" || o.status === "billing") && !o.hidden);
  const finalAmount = (o: Order) => billOf.get(o.id)?.amount ?? orderPrice(o.sheets_count, rateOf.get(o.user_id)).amount;
  const pendingSum = pending.reduce((s, o) => s + (finalAmount(o) ?? 0), 0);
  const hoursBy = new Map<string, WorkHour[]>();
  (data?.hours ?? []).forEach((h) => hoursBy.set(h.user_id, [...(hoursBy.get(h.user_id) ?? []), h]));
  const hoursSum = [...hoursBy].reduce((s, [u, ls]) => s + monthHours(ls, rateOf.get(u)).amount, 0);
  const retainerAlerts = [...rateOf.values()].filter((r) => r.retainer_hours && monthHours(hoursBy.get(r.user_id) ?? [], r).used >= r.retainer_hours * 0.8);
  const missing = pending.filter((o) => finalAmount(o) == null).length;

  const TABS: [Tab, string][] = [["orders", "הזמנות לחיוב"], ["hours", "שעות עבודה"], ["rates", "מחירון לקוחות"]];
  return (
    <AppShell admin title="חיוב">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <h1 className="flex-1 text-3xl">חיוב</h1>
        <div className="flex items-center gap-1" aria-label="חודש">
          <button className="btn-ghost px-2.5" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="חודש קודם"><ChevronRight className="h-4 w-4" /></button>
          <span className="num min-w-24 text-center text-lg font-bold">{monthLabel(month)}</span>
          <button className="btn-ghost px-2.5" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="חודש הבא"><ChevronLeft className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="הזמנות שממתינות לחיוב" value={ils(pendingSum)} sub={`${pending.length} הזמנות · ${new Set(pending.map((o) => o.user_id)).size} לקוחות${missing ? ` · ${missing} בלי מחיר` : ""}`} warn={missing > 0} />
        <Stat label={`שעות וריטיינר · ${monthLabel(month)}`} value={ils(hoursSum)} sub={`${(data?.hours ?? []).reduce((s, h) => s + Number(h.hours), 0)} שעות שנרשמו`} />
        <Stat label="סה״כ לחיוב כולל מע״מ" value={ils((pendingSum + hoursSum) * (1 + VAT))} sub={`לפני מע״מ ${ils(pendingSum + hoursSum)}`} dark />
        <Stat label="ריטיינרים שמתקרבים לסוף" value={String(retainerAlerts.length)} sub={retainerAlerts.length ? retainerAlerts.map((r) => nameOf(data?.clients.find((c) => c.id === r.user_id))).join(", ") : "אין"} warn={retainerAlerts.length > 0} />
      </div>

      <div className="mb-4 flex gap-1 border-b-2 border-slate" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-0.5 border-b-4 px-4 py-2.5 font-bold ${tab === k ? "border-cut text-slate" : "border-transparent text-steel hover:text-slate"}`}>{l}</button>
        ))}
      </div>

      {!data ? <p className="text-steel">טוען…</p> :
        tab === "orders" ? <OrdersTab orders={data.orders} clients={data.clients} rateOf={rateOf} billOf={billOf} month={month} reload={reload} /> :
        tab === "hours" ? <HoursTab month={month} clients={data.clients} orders={data.orders} hours={data.hours} rateOf={rateOf} reload={reload} /> :
        <RatesTab clients={data.clients} rateOf={rateOf} reload={reload} />}
    </AppShell>
  );
}

function Stat({ label, value, sub, warn, dark }: { label: string; value: string; sub: string; warn?: boolean; dark?: boolean }) {
  return (
    <div className={`grid gap-0.5 rounded-xl border p-3.5 ${dark ? "border-slate bg-slate text-white" : warn ? "border-warn/50 bg-warn/10" : "border-line bg-white"}`}>
      <span className={`text-sm font-semibold ${dark ? "text-white/80" : warn ? "text-warn" : "text-steel"}`}>{label}</span>
      <span className="num text-2xl font-bold">{value}</span>
      <span className={`text-xs ${dark ? "text-white/75" : "text-steel"}`}>{sub}</span>
    </div>
  );
}

/* ───────────── orders ───────────── */

function OrdersTab({ orders, clients, rateOf, billOf, month, reload }: {
  orders: Order[]; clients: Profile[]; rateOf: Map<string, BillingRate>; billOf: Map<string, OrderBilling>; month: string; reload: () => void;
}) {
  const [client, setClient] = useState("");
  const [showBilled, setShowBilled] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const list = orders.filter((o) => !o.hidden && (!client || o.user_id === client) &&
    (o.status === "done" || o.status === "billing" || (showBilled && o.status === "billed" && (billOf.get(o.id)?.billed_at ?? o.updated_at).startsWith(month))));
  const groups = [...new Set(list.map((o) => o.user_id))].map((u) => ({ u, c: clients.find((x) => x.id === u), os: list.filter((o) => o.user_id === u) }))
    .sort((a, b) => nameOf(a.c).localeCompare(nameOf(b.c), "he"));
  const calc = (o: Order) => orderPrice(o.sheets_count, rateOf.get(o.user_id));
  const final = (o: Order) => billOf.get(o.id)?.amount ?? calc(o).amount;
  const total = list.reduce((s, o) => s + (final(o) ?? 0), 0);
  const ids = [...sel].filter((id) => list.some((o) => o.id === id));

  const run = async (f: () => Promise<void>, done: string) => {
    setBusy(true); setMsg("");
    try { await f(); setMsg(done); setSel(new Set()); reload(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const markBilled = () => {
    const inv = prompt("מספר חשבונית (אפשר להשאיר ריק):", "");
    if (inv === null) return;
    run(async () => {
      for (const id of ids) {
        const o = list.find((x) => x.id === id)!;
        await api.saveOrderBilling({ order_id: id, amount: final(o), invoice_no: inv, billed_at: new Date().toISOString() });
        if (o.status !== "billed") await api.updateOrder(id, { status: "billed" });
      }
    }, `${ids.length} הזמנות סומנו כחויבו`);
  };
  const exportXlsx = () => {
    const rows = list.map((o) => {
      const a = final(o); return {
        "לקוח": nameOf(clients.find((c) => c.id === o.user_id)), "הזמנה": o.order_no, "פרויקט": o.project_name, "לוחות": o.sheets_count ?? "",
        "לפני מע״מ": a ?? "", "מע״מ": a == null ? "" : +(a * VAT).toFixed(2), "כולל מע״מ": a == null ? "" : +(a * (1 + VAT)).toFixed(2),
        "הערה": billOf.get(o.id)?.note ?? "", "חשבונית": billOf.get(o.id)?.invoice_no ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows); ws["!cols"] = [{ wch: 22 }, { wch: 8 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 24 }, { wch: 10 }];
    const wb = XLSX.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws, "חיוב");
    XLSX.writeFile(wb, `חיוב ${monthLabel(month).replace("/", "-")}.xlsx`);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className="field w-60" value={client} onChange={(e) => setClient(e.target.value)} aria-label="לקוח">
          <option value="">כל הלקוחות</option>{clients.filter((c) => c.role !== "admin").map((c) => <option key={c.id} value={c.id}>{nameOf(c)}</option>)}
        </select>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-slate" checked={showBilled} onChange={(e) => setShowBilled(e.target.checked)} />להציג גם הזמנות שחויבו ב-{monthLabel(month)}</label>
        <span className="flex-1" />
        <button className="btn-ghost" onClick={exportXlsx} disabled={!list.length}><Download className="h-4 w-4" aria-hidden />ייצוא לאקסל</button>
      </div>

      <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 border-2 border-slate bg-white p-3">
        <span className="font-semibold">{ids.length ? `נבחרו ${ids.length} הזמנות · ${ils(ids.reduce((s, id) => s + (final(list.find((o) => o.id === id)!) ?? 0), 0))}` : "סמנו הזמנות כדי לחייב"}</span>
        <span className="flex-1" />
        <button className="btn-ghost py-1.5" disabled={!ids.length || busy} onClick={() => run(async () => { for (const id of ids) await api.updateOrder(id, { status: "billing" }); }, "הועברו ל'לחיוב'")}>העברה ל"לחיוב"</button>
        <button className="btn-cut py-1.5" disabled={!ids.length || busy} onClick={markBilled}><Check className="h-4 w-4" aria-hidden />סימון כחויבו</button>
        {msg && <span role="status" className="w-full text-sm">{msg}</span>}
      </div>

      {!groups.length && <p className="panel p-6 text-center text-steel">אין הזמנות שממתינות לחיוב. הזמנה מגיעה לכאן כשמסמנים אותה "הושלמה".</p>}
      {groups.map(({ u, c, os }) => {
        const r = rateOf.get(u);
        const sub = os.reduce((s, o) => s + (final(o) ?? 0), 0);
        return (
          <section key={u} className="panel overflow-x-auto">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line bg-sheet px-4 py-3">
              <h2 className="text-lg"><Link to={`/admin/clients/${u}`} className="hover:underline">{nameOf(c)}</Link></h2>
              <span className="text-sm text-steel">{r?.min_price != null ? `מינימום ${ils(r.min_price)} עד ${r.min_sheets ?? 0} לוחות · ${ils(r.per_sheet)} ללוח נוסף` : "אין תעריף. אפשר להגדיר בלשונית 'מחירון לקוחות'"}</span>
              <span className="flex-1" />
              <span className="num font-bold">{ils(sub)} <span className="text-sm font-normal text-steel">לפני מע״מ</span></span>
            </div>
            <table className="w-full min-w-[920px] text-right text-sm">
              <thead className="text-steel"><tr>
                <th className="w-10 p-2.5"><input type="checkbox" className="h-4 w-4 accent-slate" aria-label="בחירת כל ההזמנות של הלקוח"
                  checked={os.every((o) => sel.has(o.id))} onChange={(e) => setSel((s0) => { const n = new Set(s0); os.forEach((o) => (e.target.checked ? n.add(o.id) : n.delete(o.id))); return n; })} /></th>
                <th className="p-2.5">#</th><th className="p-2.5">פרויקט</th><th className="p-2.5">סטטוס</th><th className="p-2.5">לוחות</th>
                <th className="p-2.5">לפי התעריף</th><th className="p-2.5">סכום לחיוב</th><th className="p-2.5">הערה</th></tr></thead>
              <tbody>{os.map((o) => {
                const b = billOf.get(o.id); const k = calc(o);
                return (
                  <tr key={o.id} className="border-t border-line align-middle">
                    <td className="p-2.5"><input type="checkbox" className="h-4 w-4 accent-slate" aria-label={`בחירת הזמנה ${o.order_no}`} checked={sel.has(o.id)}
                      onChange={(e) => setSel((s0) => { const n = new Set(s0); e.target.checked ? n.add(o.id) : n.delete(o.id); return n; })} /></td>
                    <td className="num p-2.5">{o.order_no}</td>
                    <td className="p-2.5 font-semibold"><Link to={`/admin/order/${o.id}`} className="hover:underline">{o.project_name}</Link></td>
                    <td className="p-2.5"><StatusBadge status={o.status} admin />{b?.invoice_no && <span className="ms-2 text-xs text-steel">חשבונית {b.invoice_no}</span>}</td>
                    <td className="p-2.5"><input className="field w-20 py-1" inputMode="numeric" aria-label={`לוחות בהזמנה ${o.order_no}`} defaultValue={o.sheets_count ?? ""}
                      onBlur={async (e) => { const v = num(e.target.value); if (v !== (o.sheets_count ?? null)) { await api.updateOrder(o.id, { sheets_count: v }); reload(); } }} /></td>
                    <td className="p-2.5"><span className="num font-semibold">{ils(k.amount)}</span><div className="text-xs text-steel">{k.how}</div></td>
                    <td className="p-2.5"><input className="field w-28 py-1" inputMode="decimal" aria-label={`סכום לחיוב בהזמנה ${o.order_no}`} placeholder={k.amount == null ? "סכום" : String(k.amount)} defaultValue={b?.amount ?? ""}
                      onBlur={async (e) => { const v = num(e.target.value); if (v !== (b?.amount ?? null)) { await api.saveOrderBilling({ order_id: o.id, amount: v }); reload(); } }} /></td>
                    <td className="p-2.5"><input className="field min-w-40 py-1" aria-label={`הערת חיוב להזמנה ${o.order_no}`} defaultValue={b?.note ?? ""}
                      onBlur={async (e) => { if (e.target.value !== (b?.note ?? "")) { await api.saveOrderBilling({ order_id: o.id, note: e.target.value }); reload(); } }} /></td>
                  </tr>);
              })}</tbody>
            </table>
          </section>
        );
      })}
      {groups.length > 0 && (
        <div className="panel flex flex-wrap justify-end gap-x-8 gap-y-1 p-4 text-lg">
          <span>לפני מע״מ: <b className="num">{ils(total)}</b></span>
          <span>מע״מ {VAT * 100}%: <b className="num">{ils(total * VAT)}</b></span>
          <span>סה״כ: <b className="num text-cut-ink">{ils(total * (1 + VAT))}</b></span>
        </div>
      )}
    </div>
  );
}

/* ───────────── hours ───────────── */

function HoursTab({ month, clients, orders, hours, rateOf, reload }: {
  month: string; clients: Profile[]; orders: Order[]; hours: WorkHour[]; rateOf: Map<string, BillingRate>; reload: () => void;
}) {
  const real = clients.filter((c) => c.role !== "admin");
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ user_id: "", work_date: today.startsWith(month) ? today : `${month}-01`, hours: "", description: "", order_id: "" });
  const [err, setErr] = useState("");
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    const h = num(f.hours);
    if (!f.user_id || !h || h <= 0) { setErr("בוחרים לקוח ומקלידים מספר שעות"); return; }
    try { await api.saveHours({ user_id: f.user_id, work_date: f.work_date, hours: h, description: f.description, order_id: f.order_id || null }); setF({ ...f, hours: "", description: "", order_id: "" }); reload(); }
    catch (x) { setErr((x as Error).message); }
  };
  const by = [...new Set([...hours.map((h) => h.user_id), ...[...rateOf.values()].filter((r) => r.retainer_hours).map((r) => r.user_id)])]
    .map((u) => ({ u, c: clients.find((x) => x.id === u), ls: hours.filter((h) => h.user_id === u) }))
    .filter((g) => g.c).sort((a, b) => nameOf(a.c).localeCompare(nameOf(b.c), "he"));

  return (
    <div className="grid gap-4">
      <form onSubmit={add} className="panel grid gap-3 p-4 md:grid-cols-[1.2fr_.8fr_.5fr_1.6fr_1fr_auto] md:items-end">
        <div><label className="label" htmlFor="h-client">לקוח</label>
          <select id="h-client" className="field" value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value, order_id: "" })}>
            <option value="">בחירה…</option>{real.map((c) => <option key={c.id} value={c.id}>{nameOf(c)}</option>)}</select></div>
        <div><label className="label" htmlFor="h-date">תאריך</label><input id="h-date" type="date" className="field" value={f.work_date} onChange={(e) => setF({ ...f, work_date: e.target.value })} /></div>
        <div><label className="label" htmlFor="h-hours">שעות</label><input id="h-hours" className="field" inputMode="decimal" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></div>
        <div><label className="label" htmlFor="h-desc">מה נעשה</label><input id="h-desc" className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><label className="label" htmlFor="h-order">הזמנה (לא חובה)</label>
          <select id="h-order" className="field" value={f.order_id} onChange={(e) => setF({ ...f, order_id: e.target.value })} disabled={!f.user_id}>
            <option value="">—</option>{orders.filter((o) => o.user_id === f.user_id).map((o) => <option key={o.id} value={o.id}>#{o.order_no} {o.project_name}</option>)}</select></div>
        <button className="btn-cut"><Plus className="h-4 w-4" aria-hidden />הוספה</button>
        {err && <p role="alert" className="text-sm text-red-700 md:col-span-6">{err}</p>}
      </form>

      {!by.length && <p className="panel p-6 text-center text-steel">לא נרשמו שעות ב-{monthLabel(month)}.</p>}
      {by.map(({ u, c, ls }) => {
        const r = rateOf.get(u); const m = monthHours(ls, r);
        const pct = m.total ? Math.min(100, (m.used / m.total) * 100) : 0;
        const state = !m.total ? "" : m.used >= m.total ? "over" : m.used >= m.total * 0.8 ? "low" : "ok";
        return (
          <section key={u} className="panel overflow-x-auto">
            <div className="grid gap-2 border-b border-line bg-sheet px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-4">
                <h2 className="text-lg">{nameOf(c)}</h2>
                <span className="text-sm text-steel">{m.total ? `ריטיינר ${ils(r?.retainer_price)} לחודש · ${m.total} שעות` : "לפי שעה"}{r?.hourly_rate != null ? ` · ${ils(r.hourly_rate)} לשעה${m.total ? " מעבר לריטיינר" : ""}` : " · אין תעריף שעה"}</span>
                <span className="flex-1" />
                <span className="num font-bold">{ils(m.amount)} <span className="text-sm font-normal text-steel">לפני מע״מ</span></span>
              </div>
              {m.total != null && (
                <div className="flex items-center gap-3">
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-line" role="img" aria-label={`נוצלו ${m.used} מתוך ${m.total} שעות`}>
                    <div className={`h-full ${state === "over" ? "bg-red-600" : state === "low" ? "bg-cut" : "bg-ok"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`num text-sm font-bold ${state === "over" ? "text-red-700" : state === "low" ? "text-cut-ink" : ""}`}>
                    {m.used} / {m.total} שעות {state === "over" ? `· חריגה ${m.over} שעות (${ils(m.hourly)})` : `· נשארו ${m.left}`}</span>
                </div>
              )}
            </div>
            {ls.length > 0 && (
              <table className="w-full min-w-[640px] text-right text-sm">
                <thead className="text-steel"><tr><th className="p-2.5">תאריך</th><th className="p-2.5">שעות</th><th className="p-2.5">מה נעשה</th><th className="p-2.5">הזמנה</th><th className="p-2.5">חויב</th><th className="p-2.5"><span className="sr-only">פעולות</span></th></tr></thead>
                <tbody>{ls.map((h) => {
                  const o = orders.find((x) => x.id === h.order_id);
                  return (
                    <tr key={h.id} className="border-t border-line">
                      <td className="num p-2.5">{new Date(h.work_date).toLocaleDateString("he-IL")}</td>
                      <td className="num p-2.5 font-semibold">{h.hours}</td>
                      <td className="p-2.5">{h.description}</td>
                      <td className="p-2.5">{o ? <Link to={`/admin/order/${o.id}`} className="hover:underline">#{o.order_no}</Link> : "—"}</td>
                      <td className="p-2.5"><input type="checkbox" className="h-4 w-4 accent-slate" aria-label="חויב" checked={!!h.billed_at}
                        onChange={async (e) => { await api.saveHours({ ...h, billed_at: e.target.checked ? new Date().toISOString() : null }); reload(); }} /></td>
                      <td className="p-2"><button className="rounded-lg p-2 text-steel hover:bg-red-50 hover:text-red-700" aria-label="מחיקת השורה"
                        onClick={async () => { if (confirm("למחוק את שורת השעות?")) { await api.deleteHours(h.id); reload(); } }}><Trash2 className="h-4 w-4" /></button></td>
                    </tr>);
                })}</tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ───────────── rates ───────────── */

const RATE_FIELDS: [keyof BillingRate, string][] = [
  ["min_price", "מחיר מינימום ₪"], ["min_sheets", "עד כמה לוחות"], ["per_sheet", "₪ לכל לוח נוסף"],
  ["hourly_rate", "₪ לשעה"], ["retainer_price", "ריטיינר ₪ לחודש"], ["retainer_hours", "שעות בריטיינר"],
];

function RatesTab({ clients, rateOf, reload }: { clients: Profile[]; rateOf: Map<string, BillingRate>; reload: () => void }) {
  const [saved, setSaved] = useState("");
  const real = clients.filter((c) => c.role !== "admin").sort((a, b) => nameOf(a).localeCompare(nameOf(b), "he"));
  const save = async (c: Profile, k: keyof BillingRate, v: number | null) => {
    const cur: BillingRate = rateOf.get(c.id) ?? { user_id: c.id, min_price: null, min_sheets: null, per_sheet: null, hourly_rate: null, retainer_price: null, retainer_hours: null, notes: "" };
    if (cur[k] === v) return;
    await api.saveRate({ ...cur, [k]: v }); setSaved(`נשמר: ${nameOf(c)}`); reload();
  };
  return (
    <div className="grid gap-3">
      <p className="text-steel">מחיר הזמנה = מחיר המינימום, עד מספר הלוחות שבעמודה השנייה. כל לוח מעבר לזה מוסיף את הסכום בעמודה השלישית. שעות נספרות קודם מתוך הריטיינר החודשי, וכל שעה מעבר לו לפי התעריף לשעה. כל המחירים לפני מע״מ. כל שדה נשמר כשיוצאים ממנו.</p>
      {saved && <p role="status" className="text-sm text-ok">{saved}</p>}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[980px] text-right text-sm">
          <thead className="border-b border-line bg-sheet text-steel"><tr>
            <th className="p-3">לקוח</th>{RATE_FIELDS.map(([, l]) => <th key={l} className="p-3">{l}</th>)}<th className="p-3">לדוגמה</th></tr></thead>
          <tbody>{real.map((c) => {
            const r = rateOf.get(c.id);
            const ex = [10, 20].map((n) => orderPrice(n, r).amount);
            return (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="p-3 font-semibold">{nameOf(c)}</td>
                {RATE_FIELDS.map(([k, l]) => (
                  <td key={k} className="p-2"><input className="field w-24 py-1.5" inputMode="decimal" aria-label={`${l} – ${nameOf(c)}`} defaultValue={(r?.[k] as number | null) ?? ""}
                    onBlur={(e) => save(c, k, num(e.target.value))} /></td>
                ))}
                <td className="p-3 text-xs text-steel">{ex[0] == null ? "—" : `10 לוחות ${ils(ex[0])} · 20 לוחות ${ils(ex[1])}`}</td>
              </tr>);
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
