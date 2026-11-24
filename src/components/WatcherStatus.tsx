import { api } from "@/lib/api";
import { useAsync } from "@/lib/store";

/** Shows whether the hub watcher on the iMOS PC is online (it writes a heartbeat every minute). */
export function WatcherStatus() {
  const { data, error } = useAsync(async () => ({ w: await api.watcher() }), []);
  if (!data || error) return null;
  const w = data.w;
  const age = w ? (Date.now() - new Date(w.at).getTime()) / 60000 : Infinity;
  const online = age < 5;
  const when = !w ? "" : age < 1 ? "עכשיו" : age < 60 ? `לפני ${Math.round(age)} דק׳` : new Date(w.at).toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="mb-4 grid gap-2">
      <p className={`flex flex-wrap items-center gap-2 text-sm ${online ? "text-ok" : "text-warn"}`} role="status">
        <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${online ? "bg-ok" : "bg-warn"}`} />
        {!w ? "מחשב iMOS עוד לא חובר לאתר. פתיחת תיקיות והעלאת מרכזי עבודה לא יעבדו עד שמריצים את connect_site.bat במחשב."
          : online ? `מחשב iMOS מחובר (${w.host}, עודכן ${when})` : `מחשב iMOS לא מחובר מאז ${when}. תיקיות ומרכזי עבודה יתעדכנו כשהוא יחזור.`}
        {w?.error && <span className="text-warn">· שגיאה אחרונה: {w.error}</span>}
      </p>
      {w && w.new_client_folders?.length > 0 && (
        <p className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm">
          נפתחו בדרייב תיקיות ללקוחות חדשים: <b>{w.new_client_folders.join(", ")}</b>. צריך לשתף כל תיקייה עם הלקוח שלה ב-Google Drive (פעם אחת).
        </p>
      )}
    </div>
  );
}
