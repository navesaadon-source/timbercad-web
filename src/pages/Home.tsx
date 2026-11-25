import { Link } from "react-router-dom";
import { useState } from "react";
import { FileDown, Tags, LayoutGrid, Ruler, Wrench, Database, GraduationCap, FileStack, Check } from "lucide-react";
import { PublicPage, ContactLinks, scrollToId } from "@/components/Site";
import SheetArt from "@/components/SheetArt";
import { BUSINESS } from "@/config";
import hubPart from "@/assets/hub-part.jpg";
import sheet from "@/assets/sample-sheet.json";

const SERVICES = [
  { icon: Ruler, t: "פירוק תוכניות אדריכליות", d: "מקבלים תוכנית או סקיצה ומפרקים אותה לארונות, חלקים ומידות מדויקות." },
  { icon: LayoutGrid, t: "תכנון ואופטימיזציית פלטות", d: "שיבוץ החלקים על הפלטות כדי לחתוך כמה שפחות לוחות ולהשאיר מינימום פחת." },
  { icon: FileDown, t: "קבצי CNC לכל לוח", d: "תוכנית חיתוך וקידוח מוכנה להרצה, מותאמת למכונה שלך." },
  { icon: Tags, t: "מדבקות לחלקים", d: "מדבקה לכל חלק עם מיקום על הפלטה, קנטים ושם הארון, כך שההרכבה זורמת." },
  { icon: FileStack, t: "דוחות בנייה ופרזול", d: "שרטוט פיצוץ לכל ארון ורשימת פרזול להזמנה, מוכנים לרכש ולהרכבה." },
  { icon: Database, t: "ספריות ומאגרי iMOS", d: "בנייה והתאמה של מאגרי נתונים, חומרים ופרזול לעבודה השוטפת שלך." },
  { icon: Wrench, t: "פוסט-פרוססורים ומכונות", d: "התאמת קבצי היציאה למכונה, ופתרון בעיות בקוד שעובר לרצפת הייצור." },
  { icon: GraduationCap, t: "ליווי והדרכה", d: "הטמעה בנגרייה והדרכת הצוות, עד שהעבודה רצה בלי עזרה." },
];

const STEPS = [
  ["פותחים הזמנה", "נכנסים לאזור האישי עם חשבון גוגל, נותנים שם לפרויקט ומעלים תוכניות ותמונות."],
  ["בוחרים חומרים ופרזול", "שיטת החיבור, הצירים והמגירות נשמרים כברירת מחדל ונטענים לכל הזמנה. משנים רק כשצריך."],
  ["אנחנו מתכננים", "רואים בזמן אמת את מצב העבודה. אם משהו משתנה אצלך, אפשר להקפיא את ההזמנה בלחיצה."],
  ["מקבלים מרכז עבודה", "פריסת פלטות, מדבקות להדפסה, דוחות בנייה, פרזול וקבצי מכונה, הכל בעמוד אחד להזמנה."],
];

export default function Home() {
  const s = sheet as { L: number; W: number; mat: string; T: number; parts: unknown[] };
  return (
    <PublicPage>
      {/* hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-12 md:grid-cols-[1fr_1.15fr] md:pt-20">
          <div>
            <h1 className="text-[2.6rem] leading-[1.1] md:text-[3.6rem]">מהתוכנית<br />ועד הפלטה החתוכה</h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-steel">
              ב-TimberCad אנחנו מתכננים לנגריות את כל מה שבין התוכנית למכונה: פריסת פלטות, קבצי CNC, מדבקות ודוחות בנייה.
              את הכל מקבלים במקום אחד, לכל הזמנה.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="btn-cut px-6 py-3 text-lg">פתיחת הזמנה</Link>
              <button onClick={() => scrollToId("contact")} className="btn-ghost px-6 py-3 text-lg">לשיחת היכרות</button>
            </div>
            <dl className="mt-10 flex gap-8 text-sm text-steel">
              <div><dt>שנות ניסיון</dt><dd className="num font-display text-3xl text-slate">{BUSINESS.years}+</dd></div>
            </dl>
          </div>
          <figure>
            <div className="rounded-2xl border border-line bg-sheet p-4 md:p-6"><SheetArt /></div>
            <figcaption className="mt-3 text-sm text-steel">
              פלטה אמיתית מעבודה של לקוח: <span className="num">{s.parts.length}</span> חלקים על לוח <bdi className="num">{s.L}×{s.W}</bdi> מ״מ, כפי שהמכונה חותכת אותם.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* services */}
      <section id="services" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="max-w-xl text-3xl md:text-4xl">כל מה שהנגרייה צריכה כדי שהמכונה תתחיל לחתוך</h2>
          <ul className="mt-10 grid gap-x-12 md:grid-cols-2">
            {SERVICES.map(({ icon: I, t, d }) => (
              <li key={t} className="flex gap-4 border-b border-line py-5">
                <I className="mt-1 h-6 w-6 flex-none text-cut-ink" aria-hidden />
                <div><h3 className="text-xl">{t}</h3><p className="mt-1 leading-relaxed text-steel">{d}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* process */}
      <section id="process" className="scroll-mt-20 bg-slate text-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl md:text-4xl">איך עובדים איתנו</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="border-t-4 border-cut pt-4">
                <span className="num font-display text-4xl text-ply">{i + 1}</span>
                <h3 className="mt-2 text-xl">{t}</h3>
                <p className="mt-2 leading-relaxed text-white/75">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* hub */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-3xl md:text-4xl">מרכז עבודה לכל הזמנה</h2>
            <p className="mt-4 leading-relaxed text-steel">
              כשההזמנה מוכנה, נפתח לך באזור האישי עמוד אחד שמרכז את כל העבודה. מחפשים חלק לפי מספר ורואים אותו גם על הפלטה וגם בשרטוט הבנייה.
            </p>
            <ul className="mt-6 space-y-2.5">
              {["פריסת פלטות לפי חומר, עם הדפסת מדבקה בלחיצה על חלק", "דוח בנייה לכל ארון עם סימון החלקים", "תוכניות, דוח פרזול וקבצי מכונה להורדה"].map((t) => (
                <li key={t} className="flex gap-2.5"><Check className="mt-1 h-5 w-5 flex-none text-ok" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <img src={hubPart} alt="מרכז העבודה: חלק מסומן על פלטה ובשרטוט הבנייה של הארון" className="w-full rounded-xl border border-line shadow-[0_20px_50px_-20px_rgba(31,43,51,.35)]" loading="lazy" />
        </div>
      </section>

      <Contact />
    </PublicPage>
  );
}

function Contact() {
  const [f, setF] = useState({ name: "", shop: "", phone: "", msg: "" });
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const body = `שם: ${f.name}\nנגרייה: ${f.shop}\nטלפון: ${f.phone}\n\n${f.msg}`;
    location.href = `mailto:${BUSINESS.email}?subject=${encodeURIComponent("פנייה מהאתר – " + (f.shop || f.name))}&body=${encodeURIComponent(body)}`;
  };
  return (
    <section id="contact" className="scroll-mt-20 border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
        <div>
          <h2 className="text-3xl md:text-4xl">נדבר על הנגרייה שלך</h2>
          <p className="mt-4 max-w-md leading-relaxed text-steel">ספר לנו איזו מכונה יש לך ומה אתם מייצרים. נחזור אליך לשיחת היכרות קצרה ונבנה יחד את דרך העבודה שמתאימה לכם.</p>
          <ContactLinks className="mt-6 text-lg" />
        </div>
        <form onSubmit={send} className="panel grid gap-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="c-name">שם מלא</label><input id="c-name" required className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></div>
            <div><label className="label" htmlFor="c-shop">שם הנגרייה</label><input id="c-shop" className="field" value={f.shop} onChange={(e) => setF({ ...f, shop: e.target.value })} autoComplete="organization" /></div>
          </div>
          <div><label className="label" htmlFor="c-phone">טלפון</label><input id="c-phone" type="tel" required className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" dir="ltr" /></div>
          <div><label className="label" htmlFor="c-msg">במה אפשר לעזור?</label><textarea id="c-msg" rows={4} className="field" value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} /></div>
          <button className="btn-primary justify-self-start px-6">שליחת פנייה</button>
          <p className="text-sm text-steel">הפרטים נשלחים אלינו במייל ומשמשים רק כדי לחזור אליך. <Link to="/privacy" className="underline">מדיניות פרטיות</Link></p>
        </form>
      </div>
    </section>
  );
}
