import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { AppShell, Empty, StatusBadge, fmtDate } from "@/components/ui";
import { HardwareForm } from "@/components/SpecForms";
import { OrderEditor, type Draft } from "@/components/OrderEditor";
import { api } from "@/lib/api";
import { useApp, useAsync } from "@/lib/store";
import { STATUS } from "@/lib/status";
import type { HardwareSpec } from "@/lib/types";

export const hasDefaults = (h?: HardwareSpec) => !!(h && (h.connection_method || h.hinge?.brand || h.drawer?.system_type));

export function MyOrders() {
  const { me } = useApp();
  const nav = useNavigate();
  useEffect(() => {
    let first = false;
    try { first = !sessionStorage.getItem("tc-admin-landed"); sessionStorage.setItem("tc-admin-landed", "1"); } catch { /* ignore */ }
    if (me?.role === "admin" && first) nav("/admin", { replace: true });
  }, [me, nav]);
  const { data: orders, error } = useAsync(() => api.orders(), [me?.id]);
  const active = orders?.filter((o) => !["billed", "cancelled"].includes(o.status)) ?? [];
  const past = orders?.filter((o) => ["billed", "cancelled"].includes(o.status)) ?? [];
  return (
    <AppShell title="ההזמנות שלי">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl">שלום {me?.full_name?.split(" ")[0]}</h1><p className="mt-1 text-steel">כאן רואים את כל ההזמנות ואת מצב העבודה בכל אחת.</p></div>
        <Link to="/portal/new" className="btn-cut"><Plus className="h-5 w-5" aria-hidden />הזמנה חדשה</Link>
      </div>
      {me && !hasDefaults(me.defaults) && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-info/30 bg-info/5 p-4">
          <Settings2 className="h-6 w-6 text-info" aria-hidden />
          <p className="flex-1">הגדר פעם אחת את שיטת החיבור והפרזול שאתה עובד איתם, והם ייטענו אוטומטית לכל הזמנה חדשה.</p>
          <Link to="/portal/settings" className="btn-primary">הגדרת הסטנדרט</Link>
        </div>
      )}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {orders && orders.length === 0 && (
        <Empty title="עוד אין הזמנות">פותחים הזמנה, מעלים תוכניות, ואנחנו מתחילים לעבוד.<div className="mt-5"><Link to="/portal/new" className="btn-cut">פתיחת הזמנה ראשונה</Link></div></Empty>
      )}
      {active.length > 0 && <OrderList orders={active} />}
      {past.length > 0 && (<><h2 className="mb-3 mt-10 text-2xl">הזמנות קודמות</h2><OrderList orders={past} /></>)}
    </AppShell>
  );
}

function OrderList({ orders }: { orders: NonNullable<Awaited<ReturnType<typeof api.orders>>> }) {
  return (
    <ul className="grid gap-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link to={`/portal/order/${o.id}`} className="panel flex flex-wrap items-center gap-x-6 gap-y-2 p-4 hover:border-steel">
            <span className="num w-14 font-display text-lg text-steel">#{o.order_no}</span>
            <span className="min-w-40 flex-1 text-lg font-semibold">{o.project_name}</span>
            <span className="text-sm text-steel">{STATUS[o.status].client}</span>
            <StatusBadge status={o.status} />
            <span className="num w-20 text-sm text-steel">{fmtDate(o.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function NewOrder() {
  const { me } = useApp();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!me) return <AppShell title="הזמנה חדשה"><span /></AppShell>;
  const initial: Draft = { project_name: "", hardware: JSON.parse(JSON.stringify(me.defaults ?? { hinge: {}, drawer: {} })), carcass: {}, fronts: { same_as_carcass: false }, notes: "" };
  const save = async (d: Draft, files: File[]) => {
    setBusy(true); setErr("");
    try {
      const o = await api.createOrder(d);
      if (files.length) {
        const att = [];
        for (const f of files) att.push(await api.uploadFile(me.id, o.id, f));
        await api.updateOrder(o.id, { attachments: att });
      }
      nav(`/portal/order/${o.id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <AppShell title="הזמנה חדשה">
      <h1 className="mb-6 text-3xl">הזמנה חדשה</h1>
      {err && <p role="alert" className="mb-4 text-red-700">{err}</p>}
      <OrderEditor initial={initial} onSave={save} saveLabel="שליחת ההזמנה" busy={busy} fromDefaults={hasDefaults(me.defaults)} withFiles />
    </AppShell>
  );
}

export function MySettings() {
  const { me, refresh } = useApp();
  const [f, setF] = useState(() => me && { full_name: me.full_name, company_name: me.company_name, phone: me.phone, defaults: me.defaults });
  const [msg, setMsg] = useState("");
  useEffect(() => { if (me && !f) setF({ full_name: me.full_name, company_name: me.company_name, phone: me.phone, defaults: me.defaults }); }, [me, f]);
  if (!me || !f) return <AppShell title="הסטנדרט שלי"><span /></AppShell>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("");
    try { await api.updateProfile(me.id, f); await refresh(); setMsg("נשמר. ההגדרות ייטענו בכל הזמנה חדשה."); } catch (er) { setMsg((er as Error).message); }
  };
  return (
    <AppShell title="הסטנדרט שלי">
      <h1 className="text-3xl">הסטנדרט שלי</h1>
      <p className="mb-6 mt-1 max-w-2xl text-steel">מגדירים פעם אחת איך אתם בונים ארון. ההגדרות נטענות לכל הזמנה חדשה, ואפשר לשנות אותן בהזמנה ספציפית כשיש דרישה אחרת.</p>
      <form onSubmit={save} className="grid gap-6">
        <section className="panel grid gap-4 p-5 sm:grid-cols-3">
          <div><label className="label" htmlFor="s-name">שם מלא</label><input id="s-name" className="field" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div><label className="label" htmlFor="s-co">שם העסק</label><input id="s-co" className="field" value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></div>
          <div><label className="label" htmlFor="s-ph">טלפון</label><input id="s-ph" type="tel" dir="ltr" className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        </section>
        <section className="panel p-5"><h2 className="mb-4 text-2xl">חיבור ופרזול</h2><HardwareForm value={f.defaults ?? { hinge: {}, drawer: {} }} onChange={(defaults) => setF({ ...f, defaults })} /></section>
        <div className="flex items-center gap-4"><button className="btn-cut px-8">שמירת הסטנדרט</button>{msg && <span role="status" className="text-ok">{msg}</span>}</div>
      </form>
    </AppShell>
  );
}
