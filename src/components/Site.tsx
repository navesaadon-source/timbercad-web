import { Link, NavLink } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X, Mail, Phone, MessageCircle, UserRound } from "lucide-react";
import logo from "@/assets/logo.jpeg";
import { BUSINESS, whatsappUrl } from "@/config";
import { useApp } from "@/lib/store";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label={`${BUSINESS.name} – דף הבית`}>
      <img src={logo} alt="" className="h-10 w-10 rounded-lg bg-white object-contain" />
      <span className={`font-display text-xl ${light ? "text-white" : "text-slate"}`} dir="ltr">{BUSINESS.name}</span>
    </Link>
  );
}

const LINKS: [string, string][] = [["services", "שירותים"], ["process", "איך עובדים"], ["contact", "צור קשר"]];

const sideBtn = "border-2 border-slate bg-white px-4 py-2.5 text-[15px] font-bold text-slate hover:bg-sheet";

/** The logo bar: the logo itself is the background, edge to edge. Buttons sit only at the two sides,
 *  never over the centred logo. Shrinks a little once the page scrolls. */
export function SiteHeader() {
  const { me } = useApp();
  const [open, setOpen] = useState(false);
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const on = () => setSmall(window.scrollY > 120);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const go = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); setOpen(false); scrollToId(id); };
  const area = me ? (me.role === "admin" ? "/admin" : "/portal") : "/login";
  return (
    <header className="sticky top-0 z-40">
      <div className={`logo-banner relative border-b-[5px] border-cut transition-[height] duration-200 ${small ? "h-[84px] md:h-[110px]" : "h-[120px] md:h-[200px]"}`}>
        <Link to="/" className="absolute inset-y-0 left-1/2 w-[46%] max-w-[440px] -translate-x-1/2" aria-label={`${BUSINESS.name} – דף הבית`} />
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-8">
          <nav className="hidden gap-2 md:flex" aria-label="ניווט ראשי">
            {LINKS.slice(0, 2).map(([id, t]) => <a key={id} href={`#${id}`} onClick={go(id)} className={sideBtn}>{t}</a>)}
          </nav>
          <button className="grid h-11 w-11 place-items-center border-2 border-slate bg-white md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="תפריט">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex gap-2">
            <a href="#contact" onClick={go("contact")} className={`${sideBtn} hidden md:inline-block`}>צור קשר</a>
            <Link to={area} className="hidden border-2 border-slate bg-slate px-4 py-2.5 text-[15px] font-bold text-white hover:bg-slate-2 md:inline-block">
              {me ? "לאזור האישי" : "כניסה ללקוחות"}
            </Link>
            <Link to={area} className="grid h-11 w-11 place-items-center border-2 border-slate bg-slate text-white md:hidden" aria-label={me ? "לאזור האישי" : "כניסה ללקוחות"}>
              <UserRound className="h-5 w-5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
      {open && (
        <nav className="border-b-2 border-slate bg-white px-5 py-2 md:hidden" aria-label="ניווט ראשי">
          {LINKS.map(([id, t]) => <a key={id} href={`#${id}`} onClick={go(id)} className="block px-2 py-3 text-lg font-bold">{t}</a>)}
          <Link to={area} className="block px-2 py-3 text-lg font-bold text-cut-ink">{me ? "לאזור האישי" : "כניסה ללקוחות"}</Link>
        </nav>
      )}
    </header>
  );
}

export function scrollToId(id: string) {
  if (location.hash.replace(/^#\/?/, "") !== "") { location.hash = "/"; setTimeout(() => scrollToId(id), 80); return; }
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function ContactLinks({ className = "" }: { className?: string }) {
  return (
    <ul className={`space-y-2 ${className}`}>
      <li><a href={`mailto:${BUSINESS.email}`} className="inline-flex items-center gap-2 hover:underline"><Mail className="h-4 w-4" aria-hidden />{BUSINESS.email}</a></li>
      {BUSINESS.phone && <li><a href={`tel:${BUSINESS.phone.replace(/\D/g, "")}`} className="inline-flex items-center gap-2 hover:underline"><Phone className="h-4 w-4" aria-hidden /><bdi>{BUSINESS.phone}</bdi></a></li>}
      {whatsappUrl() && <li><a href={whatsappUrl()} target="_blank" rel="noopener" className="inline-flex items-center gap-2 hover:underline"><MessageCircle className="h-4 w-4" aria-hidden />שליחת הודעה בוואטסאפ</a></li>}
    </ul>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-slate text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm leading-relaxed">TimberCad – תכנון CAD/CAM לנגריות. מתוכנית אדריכלית ועד קבצים, מדבקות ודוחות שמוכנים לרצפת הייצור.</p>
        </div>
        <div>
          <h2 className="mb-3 text-lg text-white">יצירת קשר</h2>
          <ContactLinks />
        </div>
        <div>
          <h2 className="mb-3 text-lg text-white">מידע</h2>
          <ul className="space-y-2">
            <li><Link to="/accessibility" className="hover:underline">הצהרת נגישות</Link></li>
            <li><Link to="/privacy" className="hover:underline">מדיניות פרטיות</Link></li>
            <li><Link to="/terms" className="hover:underline">תנאי שימוש ושירות</Link></li>
            <li><Link to="/login" className="hover:underline">כניסה ללקוחות</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-sm">© {new Date().getFullYear()} {BUSINESS.name}</div>
    </footer>
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return (<><SiteHeader /><main id="main">{children}</main><SiteFooter /><WhatsAppButton /></>);
}

export function NavItem({ to, children, end }: { to: string; children: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) =>
      `whitespace-nowrap border-b-4 px-4 py-3 text-[15px] font-bold ${isActive ? "border-cut text-white" : "border-transparent text-white/75 hover:text-white"}`}>
      {children}
    </NavLink>
  );
}

export function WhatsAppButton() {
  const url = whatsappUrl();
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener" aria-label="שליחת הודעה בוואטסאפ"
      className="fixed bottom-5 right-5 z-50 grid h-13 w-13 place-items-center rounded-full bg-[#1f8f4e] text-white shadow-lg hover:brightness-110">
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.6a10.6 10.6 0 0 1-5.4-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.6 10.6 0 1 1 16 26.6zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8.9 3.8.8a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.2-.3-.3-.6-.5z"/></svg>
    </a>
  );
}
