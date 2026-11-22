import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { Logo } from "@/components/Site";
import SheetArt from "@/components/SheetArt";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function Login() {
  const { me, loading } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = "כניסה ללקוחות – TimberCad"; }, []);
  if (!loading && me) return <Navigate to={me.role === "admin" ? "/admin" : "/portal"} replace />;

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setErr(""); setBusy(true);
    try { await fn(); after?.(); } catch (e) { setErr((e as Error).message || "הכניסה נכשלה, נסה שוב"); } finally { setBusy(false); }
  };

  return (
    <main id="main" className="grid min-h-screen md:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 md:px-16">
        <Logo />
        <h1 className="mt-10 text-4xl">כניסה לאזור הלקוחות</h1>
        <p className="mt-3 max-w-sm text-steel">לקוח חדש? הכניסה הראשונה פותחת לך חשבון. אין סיסמה לזכור.</p>
        <div className="mt-8 grid max-w-sm gap-3">
          <button className="btn-ghost justify-center py-3 text-lg" disabled={busy}
            onClick={() => run(() => api.signInGoogle(), () => api.demo && nav("/portal"))}>
            <GoogleMark /> כניסה עם חשבון גוגל
          </button>
          <div className="my-2 flex items-center gap-3 text-sm text-steel"><span className="h-px flex-1 bg-line" />או קישור כניסה למייל<span className="h-px flex-1 bg-line" /></div>
          {sent ? (
            <p role="status" className="rounded-lg bg-ok/10 p-4 text-ok">שלחנו קישור כניסה ל-<bdi>{email}</bdi>. פתח את המייל ולחץ על הקישור.</p>
          ) : (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(() => api.signInEmail(email), () => (api.demo ? nav("/portal") : setSent(true))); }}>
              <label className="label" htmlFor="email">כתובת מייל</label>
              <input id="email" type="email" required dir="ltr" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              <button className="btn-primary py-3" disabled={busy}><Mail className="h-5 w-5" aria-hidden />שליחת קישור כניסה</button>
            </form>
          )}
          {err && <p role="alert" className="text-red-700">{err}</p>}
          {api.demo && (
            <div className="mt-4 rounded-lg border border-dashed border-warn/60 bg-warn/5 p-4 text-sm">
              <b>מצב הדגמה.</b> המערכת עוד לא מחוברת למסד נתונים. אפשר להיכנס כ:
              <div className="mt-2 flex gap-2">
                <button className="btn-ghost py-1.5 text-sm" onClick={() => run(() => api.signInEmail("office@cosmec.co.il"), () => nav("/portal"))}>לקוח (COSMEC)</button>
                <button className="btn-ghost py-1.5 text-sm" onClick={() => run(() => api.signInEmail("timbercad.cnc@gmail.com"), () => nav("/admin"))}>מנהל</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="hidden items-center bg-slate p-14 md:flex">
        <div className="w-full rounded-2xl bg-slate-2 p-6"><SheetArt /></div>
      </div>
    </main>
  );
}
