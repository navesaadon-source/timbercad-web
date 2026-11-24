import { useState } from "react";
import { Link } from "react-router-dom";
import { Upload } from "lucide-react";
import { AppShell, StatusBadge } from "@/components/ui";
import { api, type ImportResult } from "@/lib/api";
import { mapAll, readFile, type LegacyFile } from "@/lib/legacy";
import type { OrderStatus } from "@/lib/types";

const KIND: Record<string, string> = { profiles: "לקוחות", orders: "הזמנות", options: "אפשרויות (לתרגום בחירות ישנות)", user_roles: "הרשאות", unknown: "לא זוהה" };

export function AdminImport() {
  const [files, setFiles] = useState<LegacyFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<ImportResult | null>(null);
  const m = mapAll(files);

  const add = async (list: FileList | null) => {
    if (!list) return;
    setErr(""); setRes(null);
    try {
      const read = await Promise.all([...list].map(readFile));
      setFiles((cur) => [...cur.filter((f) => !read.some((r) => r.name === f.name)), ...read]);
    } catch (e) { setErr(`לא הצלחתי לקרוא את הקובץ: ${(e as Error).message}`); }
  };
  const run = async () => {
    setBusy(true); setErr("");
    try { setRes(await api.importLegacy(m.clients, m.orders)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <AppShell admin title="ייבוא מהמערכת הקודמת">
      <p className="mb-2 text-sm"><Link to="/admin/clients" className="text-info underline">לקוחות</Link></p>
      <h1 className="mb-2 text-3xl">ייבוא מהמערכת הקודמת</h1>
      <p className="mb-6 max-w-2xl text-steel">מעבירים את הלקוחות וההזמנות מאפליקציית ההזמנות הקודמת. הלקוחות לא מקבלים מייל. כשהם נכנסים לאתר החדש עם אותה כתובת מייל, ההזמנות שלהם כבר מחכות להם.</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="grid content-start gap-6">
          <section className="panel p-5">
            <h2 className="mb-3 text-xl">ייצוא מהמערכת הקודמת</h2>
            <ol className="list-decimal grid gap-2 pr-5">
              <li>בפרויקט ב-Lovable פותחים <b>Cloud</b> ואז <b>Database</b> ואז <b>Tables</b>.</li>
              <li>בטבלה <b dir="ltr">profiles</b> לוחצים על ייצוא ל-CSV. אותו דבר בטבלה <b dir="ltr">orders</b>.</li>
              <li>מומלץ לייצא גם את <b dir="ltr">options</b>: כך הבחירות מההזמנות הישנות נשמרות בהערות הפנימיות.</li>
              <li>גוררים את כל הקבצים לכאן.</li>
            </ol>
          </section>

          <label className="panel flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed p-8 text-center hover:bg-sheet"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}>
            <Upload className="h-7 w-7 text-steel" aria-hidden />
            <span className="font-semibold">בחירת קבצים או גרירה לכאן</span>
            <span className="text-sm text-steel">CSV, Excel או JSON</span>
            <input type="file" multiple accept=".csv,.xlsx,.xls,.json,text/csv" className="sr-only" onChange={(e) => add(e.target.files)} />
          </label>

          {files.length > 0 && (
            <section className="panel p-5">
              <h2 className="mb-3 text-xl">קבצים</h2>
              <ul className="grid gap-1">{files.map((f) => (
                <li key={f.name} className="flex items-center gap-3">
                  <span className="flex-1 truncate" dir="ltr">{f.name}</span>
                  <span className={f.kind === "unknown" ? "text-warn" : "text-steel"}>{KIND[f.kind]} · {f.rows.length} שורות</span>
                  <button className="text-sm text-info underline" onClick={() => setFiles(files.filter((x) => x !== f))}>הסרה</button>
                </li>))}</ul>
            </section>
          )}

          {m.clients.length > 0 && (
            <section className="panel overflow-x-auto">
              <h2 className="p-5 pb-3 text-xl">לקוחות לייבוא ({m.clients.length})</h2>
              <table className="w-full min-w-[640px] text-right text-sm">
                <thead className="border-y border-line bg-sheet text-steel"><tr><th className="p-2.5">עסק</th><th className="p-2.5">איש קשר</th><th className="p-2.5">מייל</th><th className="p-2.5">תיקייה בדרייב</th><th className="p-2.5">הזמנות</th></tr></thead>
                <tbody>{m.clients.map((c) => (
                  <tr key={c.legacy_id} className="border-b border-line last:border-0">
                    <td className="p-2.5 font-semibold">{c.company_name || "—"}</td><td className="p-2.5">{c.full_name}</td>
                    <td className="p-2.5" dir="ltr">{c.email}</td><td className="p-2.5">{c.drive_folder || <span className="text-steel">ייקבע אוטומטית</span>}</td>
                    <td className="num p-2.5">{m.orders.filter((o) => o.legacy_user_id === c.legacy_id).length}</td>
                  </tr>))}</tbody>
              </table>
            </section>
          )}
        </div>

        <aside className="grid content-start gap-4">
          <section className="panel grid gap-3 p-5">
            <h2 className="text-xl">סיכום</h2>
            <p><span className="num text-2xl font-bold">{m.clients.length}</span> לקוחות · <span className="num text-2xl font-bold">{m.orders.length}</span> הזמנות</p>
            {Object.keys(m.byStatus).length > 0 && (
              <ul className="grid gap-1.5">{(Object.entries(m.byStatus) as [OrderStatus, number][]).map(([s, n]) => (
                <li key={s} className="flex items-center gap-2"><StatusBadge status={s} admin /><span className="num">{n}</span></li>))}</ul>
            )}
            {m.warnings.map((w) => <p key={w} className="rounded-lg bg-warn/10 p-2 text-sm text-warn">{w}</p>)}
            <p className="text-sm text-steel">לקוח שכבר נרשם לאתר החדש מזוהה לפי המייל ולא נוצר פעמיים. אפשר להריץ שוב: הזמנות שכבר יובאו מדלגים עליהן.</p>
            <button className="btn-cut" disabled={busy || !m.orders.length && !m.clients.length} onClick={run}>
              {busy ? "מייבא…" : `ייבוא ${m.clients.length} לקוחות ו-${m.orders.length} הזמנות`}</button>
            {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          </section>
          {res && (
            <section role="status" className="panel grid gap-2 border-ok/40 p-5">
              <h2 className="text-xl text-ok">הייבוא הסתיים</h2>
              <p>לקוחות חדשים: <b className="num">{res.clientsCreated}</b> · קיימים שעודכנו: <b className="num">{res.clientsMatched}</b></p>
              <p>הזמנות שיובאו: <b className="num">{res.ordersInserted}</b>{res.ordersSkipped > 0 && <> · כבר היו: <b className="num">{res.ordersSkipped}</b></>}</p>
              {res.problems.length > 0 && <details><summary className="cursor-pointer text-warn">{res.problems.length} שורות לא יובאו</summary>
                <ul className="mt-2 grid gap-1 text-sm">{res.problems.map((p, i) => <li key={i}>{p}</li>)}</ul></details>}
              <Link to="/admin" className="btn-primary mt-2">להזמנות</Link>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
