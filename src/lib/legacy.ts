// Reads the table exports of the previous (Lovable) orders system and maps them to the new one.
// Accepts CSV / XLSX / JSON exports of the tables: profiles, orders, and optionally options and user_roles.
import * as XLSX from "xlsx";
import type { HardwareSpec, OrderStatus } from "./types";

type Row = Record<string, unknown>;
export type TableKind = "profiles" | "orders" | "options" | "user_roles" | "unknown";

export interface LegacyClient {
  legacy_id: string; email: string; full_name: string; company_name: string; phone: string; notes: string; drive_folder: string; defaults: HardwareSpec;
}
export interface LegacyOrder {
  legacy_id: string; legacy_user_id: string; project_name: string; status: OrderStatus; hardware: HardwareSpec;
  carcass: object; fronts: object; notes: string; admin_notes: string; created_at?: string; updated_at?: string;
}
export interface LegacyFile { name: string; kind: TableKind; rows: Row[] }

export async function readFile(f: File): Promise<LegacyFile> {
  let rows: Row[];
  if (/\.json$/i.test(f.name)) {
    const j = JSON.parse(await f.text());
    rows = Array.isArray(j) ? j : Array.isArray(j?.rows) ? j.rows : Array.isArray(j?.data) ? j.data : [];
  } else if (/\.csv$/i.test(f.name) || /^text\//.test(f.type)) {
    const wb = XLSX.read(await f.text(), { type: "string", raw: true });
    rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
  } else {
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", raw: true });
    rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
  }
  return { name: f.name, kind: detect(rows, f.name), rows };
}

function detect(rows: Row[], name: string): TableKind {
  const k = new Set(Object.keys(rows[0] ?? {}));
  if (k.has("project_name")) return "orders";
  if (k.has("category_key") && k.has("label_he")) return "options";
  if (k.has("role") && k.has("user_id")) return "user_roles";
  if (k.has("email") && (k.has("full_name") || k.has("sync_path"))) return "profiles";
  const n = name.toLowerCase();
  return n.includes("order") ? "orders" : n.includes("profile") ? "profiles" : n.includes("option") ? "options" : "unknown";
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const nul = (v: unknown) => { const s = str(v); return s === "" || s.toLowerCase() === "null" ? "" : s; };
function obj<T extends object>(v: unknown, fallback: T): T {
  if (v && typeof v === "object") return v as T;
  const s = nul(v); if (!s) return fallback;
  try { const j = JSON.parse(s); return j && typeof j === "object" ? j : fallback; } catch { return fallback; }
}
function date(v: unknown) {
  const s = nul(v); if (!s) return undefined;
  const d = new Date(s.includes("T") || s.includes("+") ? s : s.replace(" ", "T"));
  return isNaN(+d) ? undefined : d.toISOString();
}
/** "G:\My Drive\טימבר קאד\COSMEC" → "COSMEC" */
export function folderName(v: unknown) {
  const s = nul(v).replace(/[\\/]+$/, ""); if (!s || /^https?:/i.test(s)) return "";
  return s.split(/[\\/]/).pop()!.replace(/[\\/:*?"<>|]+/g, " ").trim();
}

export function mapStatus(status: unknown, billing: unknown): OrderStatus {
  const s = str(status).toLowerCase(), b = str(billing).toLowerCase();
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (b === "billed") return "billed";
  if (b === "ready for billing") return "billing";
  if (s === "done" || s === "archived" || s === "completed") return "done";
  if (s === "in_progress" || s === "production" || s === "locked") return "production";
  return "submitted";
}

export interface Mapped {
  clients: LegacyClient[]; orders: LegacyOrder[]; byStatus: Partial<Record<OrderStatus, number>>; warnings: string[];
}

export function mapAll(files: LegacyFile[]): Mapped {
  const of = (k: TableKind) => files.filter((f) => f.kind === k).flatMap((f) => f.rows);
  const warnings: string[] = [];
  const opt = new Map(of("options").map((o) => [str(o.id), nul(o.label_he) || nul(o.label_en)]));

  const clients: LegacyClient[] = of("profiles").map((p) => ({
    legacy_id: str(p.id), email: nul(p.email).toLowerCase(), full_name: nul(p.full_name), company_name: nul(p.company_name),
    phone: nul(p.phone), notes: nul(p.notes), drive_folder: folderName(p.sync_path),
    defaults: {
      ...(nul(p.default_connection_method) ? { connection_method: nul(p.default_connection_method) } : {}),
      hinge: obj(p.default_hinge, {}), drawer: obj(p.default_drawer, {}),
    },
  }));
  const noMail = clients.filter((c) => !c.email.includes("@"));
  if (noMail.length) warnings.push(`${noMail.length} לקוחות בלי כתובת מייל לא ייובאו (וגם ההזמנות שלהם)`);
  const known = new Set(clients.filter((c) => c.email.includes("@")).map((c) => c.legacy_id));

  const orders: LegacyOrder[] = of("orders").map((o) => {
    const extra: string[] = [];
    const price = nul(o.billed_price), desc = nul(o.billed_description);
    if (price || desc) extra.push(`חיוב במערכת הקודמת: ${[price && `₪${price}`, desc].filter(Boolean).join(" · ")}`);
    const att = obj<{ name?: string; original_name?: string }[]>(o.attachments, []);
    if (Array.isArray(att) && att.length) extra.push(`קבצים במערכת הקודמת: ${att.map((a) => a.original_name || a.name).filter(Boolean).join(", ")}`);
    const oldOpts = ([["connection_method_id", "שיטת חיבור"], ["hinge_type_id", "צירים"], ["drawer_type_id", "מגירות"], ["carcass_material_id", "חומר גוף"],
      ["carcass_color_id", "צבע גוף"], ["front_material_id", "חומר חזיתות"], ["front_color_id", "צבע חזיתות"]] as const)
      .map(([k, l]) => (nul(o[k]) && opt.get(str(o[k])) ? `${l}: ${opt.get(str(o[k]))}` : "")).filter(Boolean);
    if (oldOpts.length) extra.push(oldOpts.join(" · "));
    const hw = obj<HardwareSpec>(o.hardware, { hinge: {}, drawer: {} });
    return {
      legacy_id: str(o.id), legacy_user_id: str(o.user_id), project_name: nul(o.project_name) || "ללא שם",
      status: mapStatus(o.status, o.billing_status),
      hardware: { ...hw, hinge: hw.hinge ?? {}, drawer: hw.drawer ?? {} },
      carcass: obj(o.carcass_data ?? o.carcass, {}), fronts: obj(o.fronts_data ?? o.fronts, {}),
      notes: nul(o.notes), admin_notes: extra.join("\n"), created_at: date(o.created_at), updated_at: date(o.updated_at),
    };
  });
  const orphan = orders.filter((o) => !known.has(o.legacy_user_id));
  if (orphan.length) warnings.push(`${orphan.length} הזמנות שייכות ללקוח שלא נמצא בקובץ הלקוחות, ולא ייובאו`);
  const keep = orders.filter((o) => known.has(o.legacy_user_id));
  const byStatus: Mapped["byStatus"] = {};
  keep.forEach((o) => { byStatus[o.status] = (byStatus[o.status] ?? 0) + 1; });
  return { clients: clients.filter((c) => c.email.includes("@")), orders: keep, byStatus, warnings };
}
