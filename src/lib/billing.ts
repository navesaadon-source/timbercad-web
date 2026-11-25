import type { BillingRate, WorkHour } from "./types";

export const VAT = 0.18;
export const ils = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `₪${n.toLocaleString("he-IL", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** order price from the client's rates: the minimum covers up to N sheets, each sheet above adds a fixed amount */
export function orderPrice(sheets: number | null | undefined, r?: BillingRate): { amount: number | null; how: string } {
  if (!r || r.min_price == null) return { amount: null, how: "אין תעריף ללקוח" };
  if (sheets == null) return { amount: null, how: "חסר מספר לוחות" };
  const base = r.min_sheets ?? 0;
  const extra = Math.max(0, sheets - base);
  const per = r.per_sheet ?? 0;
  const amount = r.min_price + extra * per;
  return { amount, how: extra > 0 ? `מינימום ${ils(r.min_price)} עד ${base} לוחות + ${extra}×${ils(per)}` : `מינימום ${ils(r.min_price)} (עד ${base} לוחות)` };
}

export const monthKey = (d: string) => d.slice(0, 7);
export const monthLabel = (k: string) => { const [y, m] = k.split("-"); return `${m}/${y}`; };

/** a client's hours in one month: retainer hours first, the rest at the hourly rate */
export function monthHours(lines: WorkHour[], r?: BillingRate) {
  const used = lines.reduce((s, l) => s + Number(l.hours), 0);
  const inRetainer = r?.retainer_hours ? Math.min(used, r.retainer_hours) : 0;
  const over = used - inRetainer;
  const retainer = r?.retainer_hours ? r.retainer_price ?? 0 : 0;
  const hourly = over * (r?.hourly_rate ?? 0);
  return { used, total: r?.retainer_hours ?? null, left: r?.retainer_hours ? r.retainer_hours - used : null, over, retainer, hourly, amount: retainer + hourly };
}
