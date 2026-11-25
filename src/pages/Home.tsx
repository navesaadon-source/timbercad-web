import { Link } from "react-router-dom";
import { useState } from "react";
import { Check } from "lucide-react";
import { PublicPage, ContactLinks, scrollToId } from "@/components/Site";
import { BUSINESS } from "@/config";
import heroCnc from "@/assets/hero-cnc.jpg";
import hubPart from "@/assets/hub-part.jpg";
import exNesting from "@/assets/examples/nesting.png";
import exGcode from "@/assets/examples/gcode.png";
import exReport from "@/assets/examples/report.png";
import exImos from "@/assets/examples/imos.png";

/** main services – hovering (or focusing) a card shows a small example from real work */
const SERVICES = [
  { t: "פריסת פלטות", d: "נסטינג לפי חומר ועובי, עם מינימום פחת ומדבקה לכל חלק.", img: exNesting, alt: "דוגמה: פריסת חלקים על פלטה 2440×1220" },
  { t: "קבצי CNC", d: "תוכניות מוכנות לטעינה במכונה שלכם, לפי הכלים והפוסט-פרוססור שלה.", img: exGcode, alt: "דוגמה: קטע מתוכנית מכונה של לוח" },
  { t: "דוחות בנייה ופרזול", d: "שרטוט לכל ארון עם סימון החלקים, ורשימת פרזול להזמנה.", img: exReport, alt: "דוגמה: שרטוט פיצוץ של ארון כיור עם מספרי החלקים" },
  { t: "שירות iMOS", d: "הקמה, יחידות מותאמות ותמיכה בתוכנה לנגריות שעובדות איתה.", img: exImos, alt: "דוגמה: ארון כיור שנבנה ב-iMOS" },
];
const MORE = ["פירוק תוכניות אדריכליות לארונות וחלקים", "מדבקות לחלקים עם מיקום על הפלטה וקנטים", "ספריות ומאגרי נתונים ל-iMOS", "התאמת פוסט-פרוססורים ומכונות", "ליווי והדרכת הצוות בנגרייה"];

/** order states shown like the light tower on a machine */
const LAMPS = [
  { t: "התקבלה", d: "שולחים תוכנית וחומרים", lamp: "bg-[#55636c]", on: false },
  { t: "בייצור", d: "מתכננים ופורסים", lamp: "bg-cut shadow-[0_0_14px_var(--color-cut)]", on: true },
  { t: "מוכנה", d: "מרכז עבודה וקבצי מכונה", lamp: "bg-[#3e6b4f]", on: false },
];

export default function Home() {
  return (
    <PublicPage>
      {/* hero: text panel + full-bleed machine photo */}
      <section className="grid bg-slate md:min-h-[600px] md:grid-cols-[minmax(0,620px)_1fr]">
        <div className="flex flex-col justify-center px-5 py-14 md:px-14">
          <h1 className="font-display text-[4.2rem] text-white md:text-[6.4rem]">מהשרטוט<br />ישר למכונה</h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#c3c9ce]">
            ב-TimberCad אנחנו מתכננים לנגריות את כל מה שבין התוכנית למכונה: פריסת פלטות, קבצי CNC, מדבקות ודוחות בנייה. הכל במקום אחד, לכל הזמנה.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="btn-cut px-7 py-3.5 text-lg">פתיחת הזמנה</Link>
            <button onClick={() => scrollToId("contact")} className="btn border-2 border-[#c3c9ce] px-7 py-3 text-lg text-white hover:bg-white/10">לשיחת היכרות</button>
          </div>
          <div className="mt-11 flex items-baseline gap-3 border-t border-[#3a4a55] pt-5">
            <span className="num font-display text-6xl text-cut">{BUSINESS.years}+</span>
            <span className="text-[#c3c9ce]">שנות ניסיון ברצפות ייצור</span>
          </div>
        </div>
        <img src={heroCnc} alt="מכונת CNC חותכת פלטת עץ" className="h-64 w-full object-cover md:h-full" />
      </section>

      {/* services */}
      <section id="services" className="scroll-mt-28 border-b border-line bg-sheet">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-5xl md:text-6xl">המחלקה הטכנית של הנגרייה שלכם</h2>
          <p className="mt-3 max-w-xl text-lg text-steel">אתם מייצרים, אנחנו מתכננים: הנדסה, פריסות, קבצים ותמיכה, בלי להחזיק מתכנן במשרה מלאה.</p>
          <ul className="mt-10 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((x, i) => (
              <li key={x.t} tabIndex={0} className="group relative grid content-start gap-2 border-2 border-slate bg-white p-5 outline-none focus-visible:ring-4 focus-visible:ring-info/40">
                <span className="num font-display text-4xl text-cut-ink">0{i + 1}</span>
                <h3 className="text-xl">{x.t}</h3>
                <p className="leading-relaxed text-steel">{x.d}</p>
                <span className="mt-1 text-sm font-bold text-cut-ink">דוגמה מעבודה אמיתית ↑</span>
                <figure className="pointer-events-none absolute bottom-[calc(100%-12px)] right-4 z-20 w-60 translate-y-2 border-2 border-slate bg-white p-1.5 opacity-0 shadow-[0_18px_40px_-12px_rgba(31,43,51,.45)] transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100">
                  <img src={x.img} alt={x.alt} className="aspect-[3/2] w-full object-contain" loading="lazy" />
                </figure>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-steel">
            <span className="font-bold text-slate">ועוד:</span>
            {MORE.map((m) => <span key={m} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-cut-ink" aria-hidden />{m}</span>)}
          </div>
        </div>
      </section>

      {/* work centre */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-5xl md:text-6xl">מרכז עבודה לכל הזמנה</h2>
            <p className="mt-4 text-lg leading-relaxed text-steel">כשההזמנה מוכנה, נפתח לכם באזור האישי עמוד אחד שמרכז את כל העבודה. מחפשים חלק לפי מספר ורואים אותו גם על הפלטה וגם בשרטוט הבנייה.</p>
            <ul className="mt-6 space-y-2.5">
              {["פריסת פלטות לפי חומר, עם הדפסת מדבקה בלחיצה על חלק", "דוח בנייה לכל ארון עם סימון החלקים", "תוכניות, דוח פרזול וקבצי מכונה להורדה"].map((t) => (
                <li key={t} className="flex gap-2.5"><Check className="mt-1 h-5 w-5 flex-none text-ok" aria-hidden />{t}</li>
              ))}
            </ul>
          </div>
          <img src={hubPart} alt="מרכז העבודה: חלק מסומן על פלטה ובשרטוט הבנייה של הארון" className="w-full border-2 border-slate" loading="lazy" />
        </div>
      </section>

      {/* order states */}
      <section id="process" className="scroll-mt-28 bg-slate text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2">
          <div>
            <h2 className="font-display text-5xl md:text-6xl">כל הזמנה עם נורית מצב</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-[#c3c9ce]">כמו מגדל הנוריות על המכונה: באזור האישי רואים בכל רגע איפה ההזמנה עומדת, ועוצרים אותה בלחיצה אם צריך.</p>
          </div>
          <ol className="grid gap-2.5 border-2 border-[#4a5b66] bg-slate-2 p-5">
            {LAMPS.map((l) => (
              <li key={l.t} className={`flex items-center gap-4 bg-[#34454f] px-4 py-3.5 ${l.on ? "outline-2 outline-cut" : ""}`}>
                <span aria-hidden className={`h-5 w-5 flex-none rounded-full ${l.lamp}`} />
                <span className="text-lg font-bold">{l.t}</span>
                <span className={`ms-auto ${l.on ? "text-white" : "text-[#aab3b9]"}`}>{l.d}</span>
              </li>
            ))}
          </ol>
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
    <section id="contact" className="scroll-mt-28 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
        <div>
          <h2 className="font-display text-5xl md:text-6xl">נדבר על הנגרייה שלכם</h2>
          <p className="mt-4 max-w-md leading-relaxed text-steel">ספרו לנו איזו מכונה יש לכם ומה אתם מייצרים. נחזור אליכם לשיחת היכרות קצרה ונבנה יחד את דרך העבודה שמתאימה לכם.</p>
          <ContactLinks className="mt-6 text-lg" />
        </div>
        <form onSubmit={send} className="grid gap-4 border-2 border-slate bg-[#dde2e5] p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label text-slate" htmlFor="c-name">שם מלא</label><input id="c-name" required className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></div>
            <div><label className="label text-slate" htmlFor="c-shop">שם הנגרייה</label><input id="c-shop" className="field" value={f.shop} onChange={(e) => setF({ ...f, shop: e.target.value })} autoComplete="organization" /></div>
          </div>
          <div><label className="label text-slate" htmlFor="c-phone">טלפון</label><input id="c-phone" type="tel" required className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" dir="ltr" /></div>
          <div><label className="label text-slate" htmlFor="c-msg">במה אפשר לעזור?</label><textarea id="c-msg" rows={4} className="field" value={f.msg} onChange={(e) => setF({ ...f, msg: e.target.value })} /></div>
          <button className="btn-cut justify-self-stretch px-6 py-3 text-lg">שליחת פנייה</button>
          <p className="text-sm text-[#3e4b54]">הפרטים נשלחים אלינו במייל ומשמשים רק כדי לחזור אליך. <Link to="/privacy" className="underline">מדיניות פרטיות</Link></p>
        </form>
      </div>
    </section>
  );
}
