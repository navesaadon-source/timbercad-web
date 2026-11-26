import { useState } from "react";
import { Clock, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";

/** shown instead of the portal until the admin approves the account */
export default function Registration() {
  const { me, refresh } = useApp();
  const [f, setF] = useState({ full_name: me?.full_name ?? "", company_name: me?.company_name ?? "", phone: me?.phone ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!me) return null;

  if (me.status === "rejected") return (
    <div className="mx-auto max-w-xl panel p-8 text-center">
      <h1 className="text-3xl">הבקשה לא אושרה</h1>
      <p className="mt-3 text-steel">אם לדעתכם זו טעות, צרו איתנו קשר ונבדוק.</p>
    </div>
  );

  if (me.requested_at) return (
    <div className="mx-auto max-w-xl panel p-8 text-center">
      <Clock className="mx-auto h-10 w-10 text-info" aria-hidden />
      <h1 className="mt-3 text-3xl">הבקשה התקבלה</h1>
      <p className="mt-3 text-steel">
        נבדוק את הפרטים ונאשר את החשבון בהקדם. כשהחשבון יאושר תוכלו לפתוח הזמנות ולראות את התוכנית לדוגמה.
      </p>
      <dl className="mt-6 grid gap-1 text-right text-sm">
        <div><dt className="inline text-steel">עסק: </dt><dd className="inline font-semibold">{me.company_name}</dd></div>
        <div><dt className="inline text-steel">איש קשר: </dt><dd className="inline font-semibold">{me.full_name}</dd></div>
        <div><dt className="inline text-steel">מייל: </dt><dd className="inline font-semibold" dir="ltr">{me.email}</dd></div>
      </dl>
      <button className="btn-ghost mt-6" onClick={refresh}>בדיקה אם החשבון אושר</button>
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await api.updateProfile(me.id, {
        full_name: f.full_name.trim(), company_name: f.company_name.trim(), phone: f.phone.trim(), requested_at: new Date().toISOString(),
      });
      await refresh();
    } catch (x) { setErr((x as Error).message || "השליחה נכשלה, נסו שוב"); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl">בקשת הצטרפות</h1>
      <p className="mt-2 text-steel">כמה פרטים כדי שנדע מי אתם. אחרי שנאשר את החשבון תקבלו גישה לאזור הלקוחות.</p>
      <form className="panel mt-6 grid gap-4 p-6" onSubmit={submit}>
        <div><label className="label" htmlFor="r-name">שם מלא</label>
          <input id="r-name" className="field" required autoComplete="name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div><label className="label" htmlFor="r-company">שם הנגרייה או העסק</label>
          <input id="r-company" className="field" required autoComplete="organization" value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></div>
        <div><label className="label" htmlFor="r-phone">טלפון</label>
          <input id="r-phone" className="field" type="tel" dir="ltr" required autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><span className="label">מייל</span><p className="field bg-sheet" dir="ltr">{me.email}</p></div>
        {err && <p role="alert" className="text-red-700">{err}</p>}
        <button className="btn-cut justify-center py-3" disabled={busy}><UserPlus className="h-5 w-5" aria-hidden />שליחת הבקשה</button>
      </form>
    </div>
  );
}
