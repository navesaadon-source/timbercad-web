// Supabase Edge Function "admin": admin-only actions that need the service key.
//   create_client – open a client account by e-mail (the client later signs in with Google / e-mail link, same address)
//   import        – bring clients and orders over from the previous system (safe to run again: skips what was imported)
// Deploy: Edge Functions → Deploy a new function → name "admin" → paste → Deploy, then turn OFF "Verify JWT"
// (the function checks the signed-in user and the admin role itself).

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ?? ""; } catch { return ""; } })();
const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

type ClientIn = { legacy_id?: string; email: string; full_name?: string; company_name?: string; phone?: string; notes?: string; drive_folder?: string; defaults?: unknown };
type OrderIn = { legacy_id: string; legacy_user_id: string; project_name: string; status: string; hardware?: unknown; carcass?: unknown; fronts?: unknown;
  notes?: string; admin_notes?: string; created_at?: string; updated_at?: string };

const FIELDS = ["full_name", "company_name", "phone", "notes", "drive_folder"] as const;

async function ensureClient(c: ClientIn) {
  const email = (c.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) throw new Error(`כתובת מייל לא תקינה: ${c.email}`);
  let { data: p } = await sb.from("profiles").select("*").ilike("email", email).maybeSingle();
  let created = false;
  if (!p) {
    const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: c.full_name ?? "" } });
    let id = data?.user?.id;
    if (error) {
      // already registered in auth (no profile row yet) – find it
      const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      id = list?.users.find((u) => (u.email ?? "").toLowerCase() === email)?.id;
      if (!id) throw error;
      await sb.from("profiles").upsert({ id, email }, { onConflict: "id", ignoreDuplicates: true });
    } else created = true;
    ({ data: p } = await sb.from("profiles").select("*").eq("id", id!).single());
  }
  // fill in only what is still empty, so nothing the client or admin already typed is overwritten
  const patch: Record<string, unknown> = {};
  for (const k of FIELDS) if (c[k] && !p[k]) patch[k] = c[k];
  const d = p.defaults ?? {};
  const emptyDefaults = !d.connection_method && !Object.keys(d.hinge ?? {}).length && !Object.keys(d.drawer ?? {}).length;
  if (c.defaults && emptyDefaults) patch.defaults = c.defaults;
  if (Object.keys(patch).length) {
    const { error } = await sb.from("profiles").update(patch).eq("id", p.id);
    if (error) throw error;
  }
  return { id: p.id as string, created };
}

async function importAll(clients: ClientIn[], orders: OrderIn[]) {
  const problems: string[] = [];
  const idOf = new Map<string, string>();
  let clientsCreated = 0, clientsMatched = 0;
  for (const c of clients) {
    try {
      const r = await ensureClient(c);
      if (c.legacy_id) idOf.set(c.legacy_id, r.id);
      r.created ? clientsCreated++ : clientsMatched++;
    } catch (e) { problems.push(`לקוח ${c.email || c.full_name}: ${(e as Error).message}`); }
  }
  const done = new Set<string>();
  const ids = orders.map((o) => o.legacy_id).filter(Boolean);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from("orders").select("legacy_id").in("legacy_id", ids.slice(i, i + 200));
    if (error) throw error;
    data?.forEach((r) => done.add(r.legacy_id));
  }
  const rows = [];
  let skipped = 0;
  for (const o of [...orders].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))) {
    if (done.has(o.legacy_id)) { skipped++; continue; }
    const user_id = idOf.get(o.legacy_user_id);
    if (!user_id) { problems.push(`הזמנה "${o.project_name}": הלקוח שלה לא נמצא בקובץ הלקוחות`); continue; }
    rows.push({
      user_id, legacy_id: o.legacy_id, project_name: o.project_name || "ללא שם", status: o.status,
      hardware: o.hardware ?? { hinge: {}, drawer: {} }, carcass: o.carcass ?? {}, fronts: o.fronts ?? {},
      notes: o.notes ?? "", admin_notes: o.admin_notes ?? "",
      ...(o.created_at ? { created_at: o.created_at } : {}), ...(o.updated_at ? { updated_at: o.updated_at } : {}),
    });
  }
  let inserted = 0;
  for (const r of rows) {           // one by one, in date order, so order numbers follow the original dates
    const { error } = await sb.from("orders").insert(r);
    if (error) problems.push(`הזמנה "${r.project_name}": ${error.message}`); else inserted++;
  }
  return { clientsCreated, clientsMatched, ordersInserted: inserted, ordersSkipped: skipped, problems };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ error: "צריך להתחבר מחדש" }, 401);
    const { data: me } = await sb.from("profiles").select("role").eq("id", u.user.id).single();
    if (me?.role !== "admin") return json({ error: "פעולה למנהל בלבד" }, 403);
    const body = await req.json();
    if (body.action === "create_client") return json(await ensureClient(body.client));
    if (body.action === "import") return json(await importAll(body.clients ?? [], body.orders ?? []));
    return json({ error: "פעולה לא מוכרת" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
