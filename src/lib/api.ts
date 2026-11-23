import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Attachment, CatalogItem, Order, OrderEvent, OrderStatus, Profile } from "./types";
import { SEED } from "./catalog-seed";
import { ADMIN_EMAILS } from "@/config";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const DEMO = !URL_ || !KEY_;

export type NewOrder = Pick<Order, "project_name" | "hardware" | "carcass" | "fronts" | "notes"> & { user_id?: string };
export type OrderPatch = Partial<Omit<Order, "id" | "order_no" | "created_at" | "updated_at" | "client">>;

export interface Api {
  demo: boolean;
  session(): Promise<{ userId: string } | null>;
  onAuthChange(cb: () => void): () => void;
  signInGoogle(): Promise<void>;
  signInEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
  me(): Promise<Profile | null>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<void>;
  clients(): Promise<Profile[]>;
  catalog(): Promise<CatalogItem[]>;
  saveCatalogItem(item: Partial<CatalogItem>): Promise<void>;
  saveCatalogItems(items: Partial<CatalogItem>[]): Promise<void>;
  deleteCatalogItems(ids: string[]): Promise<void>;
  orders(opts?: { all?: boolean }): Promise<Order[]>;
  order(id: string): Promise<Order | null>;
  createOrder(o: NewOrder): Promise<Order>;
  updateOrder(id: string, patch: OrderPatch): Promise<void>;
  deleteOrder(id: string): Promise<void>;
  events(orderId: string): Promise<OrderEvent[]>;
  uploadFile(userId: string, orderId: string, file: File): Promise<Attachment>;
  fileUrl(path: string): Promise<string>;
  hubHtml(path: string): Promise<string>;
}

const ORDER_SELECT = "*, client:profiles!orders_user_id_fkey(id, full_name, company_name, email, phone)";

// ───────────────────────── Supabase ─────────────────────────
function supabaseApi(sb: SupabaseClient): Api {
  const ok = <T>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };
  return {
    demo: false,
    async session() { const { data } = await sb.auth.getSession(); return data.session ? { userId: data.session.user.id } : null; },
    onAuthChange(cb) { const { data } = sb.auth.onAuthStateChange(() => cb()); return () => data.subscription.unsubscribe(); },
    // Redirect back to the site root (no #hash – the router owns the hash); PKCE returns ?code=… which supabase-js exchanges.
    async signInGoogle() {
      markLogin();
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
      if (error) throw error;
    },
    async signInEmail(email) {
      markLogin();
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
    },
    async signOut() { await sb.auth.signOut(); },
    async me() {
      const { data } = await sb.auth.getUser(); if (!data.user) return null;
      return ok(await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle()) as Profile | null;
    },
    async updateProfile(id, patch) { ok(await sb.from("profiles").update(patch).eq("id", id)); },
    async clients() { return ok(await sb.from("profiles").select("*").order("company_name")) as Profile[]; },
    async catalog() { return ok(await sb.from("catalog").select("*").order("category").order("sort")) as CatalogItem[]; },
    async saveCatalogItem(item) { ok(await sb.from("catalog").upsert(item)); },
    async saveCatalogItems(items) { if (items.length) ok(await sb.from("catalog").upsert(items)); },
    async deleteCatalogItems(ids) { if (ids.length) ok(await sb.from("catalog").delete().in("id", ids)); },
    async orders(opts) {
      let q = sb.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false });
      if (!opts?.all) { const s = await this.session(); if (s) q = q.eq("user_id", s.userId); }
      return ok(await q) as Order[];
    },
    async order(id) { return ok(await sb.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle()) as Order | null; },
    async createOrder(o) {
      const s = await this.session();
      return ok(await sb.from("orders").insert({ ...o, user_id: o.user_id ?? s!.userId }).select(ORDER_SELECT).single()) as Order;
    },
    async updateOrder(id, patch) { ok(await sb.from("orders").update(patch).eq("id", id)); },
    async deleteOrder(id) { ok(await sb.from("orders").delete().eq("id", id)); },
    async events(orderId) { return ok(await sb.from("order_events").select("*").eq("order_id", orderId).order("created_at")) as OrderEvent[]; },
    async uploadFile(userId, orderId, file) {
      const safe = file.name.replace(/[^\w.\-֐-׿ ]+/g, "_");
      const path = `${userId}/${orderId}/${Date.now()}_${safe}`;
      ok(await sb.storage.from("project-files").upload(path, file, { upsert: false }));
      return { name: file.name, path, size: file.size, type: file.type };
    },
    async fileUrl(path) {
      const { data, error } = await sb.storage.from("project-files").createSignedUrl(path, 3600); if (error) throw error; return data.signedUrl;
    },
    async hubHtml(path) {
      const { data, error } = await sb.storage.from("hubs").download(path); if (error) throw error; return await data.text();
    },
  };
}

// ───────────────────────── Demo (browser only) ─────────────────────────
function demoApi(): Api {
  const KEY = "tc-demo-v2";
  type DB = { user: string | null; profiles: Profile[]; orders: Order[]; events: OrderEvent[]; catalog: CatalogItem[]; files: Record<string, string> };
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
  const listeners = new Set<() => void>();
  const blankHw = () => ({ hinge: {}, drawer: {} });

  function seed(): DB {
    const admin: Profile = { id: "admin", email: ADMIN_EMAILS[0], full_name: "נווה סעדון", company_name: "TimberCad", phone: "", role: "admin",
      defaults: blankHw(), notes: "", drive_folder: "", created_at: ago(400) };
    const c1: Profile = { id: "c1", email: "office@cosmec.co.il", full_name: "יוסי כהן", company_name: "COSMEC", phone: "050-1234567", role: "client",
      defaults: { connection_method: "rail_between", hinge: { brand: "blum", plate: "cruciform", fixation: "screw" }, drawer: { system_type: "complete", brand: "hettich", model: "avantech" } },
      notes: "משלם בהעברה בסוף חודש", drive_folder: "COSMEC", created_at: ago(200) };
    const c2: Profile = { id: "c2", email: "noa@nagarut-galil.co.il", full_name: "נועה לוי", company_name: "נגרות הגליל", phone: "052-7654321", role: "client",
      defaults: { connection_method: "walls_on_rail", hinge: { brand: "hettich", plate: "inline", fixation: "dowel", dowel_size: "10mm" }, drawer: { system_type: "runners_only", brand: "blum", model: "movento" } },
      notes: "", drive_folder: "נגרות הגליל", created_at: ago(90) };
    const mk = (n: number, u: Profile, name: string, status: OrderStatus, d: number, sheets: number | null): Order => ({
      id: "o" + n, order_no: 1000 + n, user_id: u.id, project_name: name, job_name: name, status,
      hardware: u.defaults, carcass: { material_type: "plywood", importer: "birman", color_code: "Plywood_2s_White", board_dim: "2440 × 1220" },
      fronts: { same_as_carcass: false, material_type: "formica", importer: "mekor", color_code: "AF36_280_122", board_dim: "2800 × 1220" },
      notes: n === 3 ? "ידיות אינטגרליות בכל המגירות" : "", admin_notes: "", attachments: [], sheets_count: sheets,
      hub_path: name === "app buliding" ? "c1/o3.html" : null, frozen_at: null, created_at: ago(d), updated_at: ago(d / 2),
    });
    const orders = [
      mk(1, c1, "מטבח משפחת כהן", "billed", 60, 18),
      mk(2, c1, "ארון הורים", "production", 4, null),
      mk(3, c1, "app buliding", "done", 6, 8),
      mk(4, c2, "ספריה סלון", "submitted", 1, null),
      mk(5, c2, "חדר כביסה", "frozen", 9, null),
    ];
    orders[4].frozen_at = ago(2);
    const PATH: OrderStatus[] = ["submitted", "production", "done", "billing", "billed"];
    const events: OrderEvent[] = orders.flatMap((o) => {
      const t0 = new Date(o.created_at).getTime();
      const ev: OrderEvent[] = [{ id: uid(), order_id: o.id, actor_id: o.user_id, kind: "created", from_status: null, to_status: "submitted", note: null, created_at: o.created_at }];
      const target = o.status === "frozen" ? "production" : o.status;
      for (let i = 1; i <= PATH.indexOf(target); i++)
        ev.push({ id: uid(), order_id: o.id, actor_id: "admin", kind: "status", from_status: PATH[i - 1], to_status: PATH[i], note: null, created_at: new Date(t0 + i * 864e5).toISOString() });
      if (o.status === "frozen") ev.push({ id: uid(), order_id: o.id, actor_id: o.user_id, kind: "frozen", from_status: "production", to_status: "frozen", note: null, created_at: o.frozen_at! });
      return ev;
    });
    const catalog: CatalogItem[] = SEED.map(([category, key, label, parent], i) => ({ id: uid(), category, key, label, parent: parent ?? null, sort: i, active: true }));
    return { user: null, profiles: [admin, c1, c2], orders, events, catalog, files: {} };
  }
  const load = (): DB => { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* storage unavailable */ } return seed(); };
  let db = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } };
  const me = () => db.profiles.find((p) => p.id === db.user) ?? null;
  const withClient = (o: Order): Order => {
    const c = db.profiles.find((p) => p.id === o.user_id);
    return { ...o, client: c && { id: c.id, full_name: c.full_name, company_name: c.company_name, email: c.email, phone: c.phone } };
  };
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const delay = <T>(x: T) => new Promise<T>((r) => setTimeout(() => r(clone(x)), 60));
  const fire = () => listeners.forEach((l) => l());

  return {
    demo: true,
    async session() { return db.user ? { userId: db.user } : null; },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async signInGoogle() { db.user = "c1"; save(); fire(); },
    async signInEmail(email) {
      const p = db.profiles.find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (p) db.user = p.id;
      else {
        const id = uid();
        db.profiles.push({ id, email, full_name: email.split("@")[0], company_name: "", phone: "", role: ADMIN_EMAILS.includes(email) ? "admin" : "client",
          defaults: blankHw(), notes: "", drive_folder: "", created_at: now() });
        db.user = id;
      }
      save(); fire();
    },
    async signOut() { db.user = null; save(); fire(); },
    async me() { return delay(me()); },
    async updateProfile(id, patch) { db.profiles = db.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)); save(); },
    async clients() { return delay(db.profiles); },
    async catalog() { return delay(db.catalog); },
    async saveCatalogItem(item) {
      if (item.id && db.catalog.some((c) => c.id === item.id)) db.catalog = db.catalog.map((c) => (c.id === item.id ? { ...c, ...item } : c));
      else db.catalog.push({ id: uid(), category: "", key: "", label: "", parent: null, sort: 999, active: true, ...item } as CatalogItem);
      save();
    },
    async saveCatalogItems(items) { for (const i of items) await this.saveCatalogItem(i); },
    async deleteCatalogItems(ids) { db.catalog = db.catalog.filter((c) => !ids.includes(c.id)); save(); },
    async orders(opts) {
      const u = me(); if (!u) return [];
      const list = db.orders.filter((o) => (opts?.all && u.role === "admin") || o.user_id === u.id);
      return delay(list.map(withClient).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async order(id) { const o = db.orders.find((x) => x.id === id); return delay(o ? withClient(o) : null); },
    async createOrder(o) {
      const u = me()!;
      const order: Order = { id: uid(), order_no: Math.max(1000, ...db.orders.map((x) => x.order_no)) + 1, user_id: o.user_id ?? u.id,
        job_name: o.project_name, status: "submitted", admin_notes: "", attachments: [], sheets_count: null, hub_path: null, frozen_at: null,
        created_at: now(), updated_at: now(), ...o } as Order;
      db.orders.push(order);
      db.events.push({ id: uid(), order_id: order.id, actor_id: u.id, kind: "created", from_status: null, to_status: "submitted", note: null, created_at: now() });
      save(); return delay(withClient(order));
    },
    async updateOrder(id, patch) {
      const u = me()!; const old = db.orders.find((o) => o.id === id)!;
      if (u.role !== "admin") {
        const s = old.status, n = patch.status;
        const okMove = !n || n === s || (s === "submitted" && n === "cancelled") || (s === "production" && n === "frozen") || (s === "frozen" && n === "production");
        const contentKeys = Object.keys(patch).filter((k) => k !== "status");
        if (!okMove || (s !== "submitted" && contentKeys.length)) throw new Error("ההזמנה כבר בייצור ואי אפשר לשנות אותה");
      }
      const next = { ...old, ...patch, updated_at: now() } as Order;
      if (patch.status && patch.status !== old.status) {
        if (patch.status === "frozen") next.frozen_at = now();
        const kind = patch.status === "frozen" ? "frozen" : old.status === "frozen" ? "unfrozen" : "status";
        db.events.push({ id: uid(), order_id: id, actor_id: u.id, kind, from_status: old.status, to_status: patch.status, note: null, created_at: now() });
      } else db.events.push({ id: uid(), order_id: id, actor_id: u.id, kind: "edited", from_status: null, to_status: null, note: null, created_at: now() });
      db.orders = db.orders.map((o) => (o.id === id ? next : o)); save();
    },
    async deleteOrder(id) { db.orders = db.orders.filter((o) => o.id !== id); save(); },
    async events(orderId) { return delay(db.events.filter((e) => e.order_id === orderId)); },
    async uploadFile(userId, orderId, file) {
      const path = `${userId}/${orderId}/${Date.now()}_${file.name}`;
      return { name: file.name, path, size: file.size, type: file.type };
    },
    async fileUrl() { return "#"; },
    async hubHtml() {
      // demo build: a real job hub is bundled from src/demo/hub-demo.html (kept out of git – it holds client data)
      if (import.meta.env.MODE === "demo") {
        const mods = import.meta.glob("/src/demo/hub-demo.html", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
        const html = Object.values(mods)[0];
        if (html) return html;
      }
      return `<!doctype html><html dir="rtl"><body style="font-family:Arial;padding:40px;color:#334"><h2>מרכז העבודה</h2>
        <p>כאן נפתח מרכז העבודה של ההזמנה: פריסת פלטות, מדבקות, דוחות בנייה, פרזול וקבצי מכונה.</p></body></html>`;
    },
  };
}

const LOGIN_FLAG = "tc-login-pending";
function markLogin() { try { localStorage.setItem(LOGIN_FLAG, String(Date.now())); } catch { /* ignore */ } }

function makeSupabase() {
  const sb = createClient(URL_!, KEY_!, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true } });
  // after returning from Google / the e-mail link: go to the personal area
  sb.auth.onAuthStateChange((event) => {
    if (event !== "SIGNED_IN") return;
    let pending = false;
    try { pending = !!localStorage.getItem(LOGIN_FLAG); localStorage.removeItem(LOGIN_FLAG); } catch { /* ignore */ }
    const onPublic = !location.hash || location.hash === "#/" || location.hash.startsWith("#/login");
    if (pending || (onPublic && location.search.includes("code="))) {
      if (location.search) history.replaceState(null, "", location.pathname + "#/portal");
      else location.hash = "#/portal";
    }
  });
  return sb;
}

export const api: Api = DEMO ? demoApi() : supabaseApi(makeSupabase());
