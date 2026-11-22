import type { OrderStatus, Role } from "./types";

export const STATUS: Record<OrderStatus, { label: string; client: string; tone: string }> = {
  submitted:  { label: "התקבלה",   client: "ההזמנה התקבלה – אפשר עדיין לערוך", tone: "info" },
  production: { label: "בייצור",   client: "אנחנו עובדים על ההזמנה",           tone: "work" },
  frozen:     { label: "מוקפאת",   client: "העבודה מוקפאת לבקשתך",              tone: "warn" },
  done:       { label: "הושלמה",   client: "הקבצים מוכנים",                     tone: "ok" },
  billing:    { label: "לחיוב",    client: "הקבצים מוכנים",                     tone: "ok" },
  billed:     { label: "חויבה",    client: "העבודה הושלמה וחויבה",              tone: "muted" },
  cancelled:  { label: "בוטלה",    client: "ההזמנה בוטלה",                      tone: "muted" },
};

// Order the client sees as a progress line
export const FLOW: OrderStatus[] = ["submitted", "production", "done", "billed"];
export const ADMIN_STATUSES: OrderStatus[] = ["submitted", "production", "frozen", "done", "billing", "billed", "cancelled"];

/** Client may edit the order content only while it was just submitted. */
export const clientCanEdit = (s: OrderStatus) => s === "submitted";
/** Client may freeze while in production, and resume while frozen. */
export const clientCanFreeze = (s: OrderStatus) => s === "production";
export const clientCanResume = (s: OrderStatus) => s === "frozen";
export const clientCanCancel = (s: OrderStatus) => s === "submitted";

export const canEdit = (role: Role, s: OrderStatus) => role === "admin" || clientCanEdit(s);

export function flowIndex(s: OrderStatus) {
  if (s === "frozen") return 1;
  if (s === "billing") return 2;
  return FLOW.indexOf(s);
}
