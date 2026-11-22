import { useApp } from "@/lib/store";
import { Choice, Field } from "./ui";
import type { FrontsSpec, HardwareSpec, MaterialSpec } from "@/lib/types";

const opts = (items: { key: string; label: string }[]) => items.map((i) => ({ key: i.key, label: i.label }));

export function HardwareForm({ value, onChange, disabled }: { value: HardwareSpec; onChange: (v: HardwareSpec) => void; disabled?: boolean }) {
  const { options } = useApp();
  const h = value.hinge ?? {}, d = value.drawer ?? {};
  const setH = (p: Partial<HardwareSpec["hinge"]>) => onChange({ ...value, hinge: { ...h, ...p } });
  const setD = (p: Partial<HardwareSpec["drawer"]>) => onChange({ ...value, drawer: { ...d, ...p } });
  const brands = options("drawer_brand").filter((b) => d.system_type === "runners_only" || b.key !== "grass");
  const models = d.system_type && d.brand ? options("drawer_model", `${d.system_type}:${d.brand}`) : [];
  return (
    <div className="grid gap-6">
      <Field label="שיטת חיבור הארון">
        <Choice name="שיטת חיבור הארון" disabled={disabled} options={opts(options("connection_method"))} value={value.connection_method}
          onChange={(v) => onChange({ ...value, connection_method: v })} />
      </Field>
      <fieldset className="grid gap-4 rounded-xl border border-line p-4">
        <legend className="px-1 font-display text-lg">צירים</legend>
        <Field label="קידוח לפי"><Choice name="קידוח צירים" disabled={disabled} options={opts(options("hinge_brand"))} value={h.brand} onChange={(v) => setH({ brand: v })} /></Field>
        <Field label="סוג תושבת"><Choice name="סוג תושבת" disabled={disabled} options={opts(options("hinge_plate"))} value={h.plate} onChange={(v) => setH({ plate: v })} /></Field>
        <Field label="חיבור התושבת"><Choice name="חיבור התושבת" disabled={disabled} options={opts(options("hinge_fixation"))} value={h.fixation}
          onChange={(v) => setH({ fixation: v, dowel_size: v === "dowel" ? h.dowel_size : undefined })} /></Field>
        {h.fixation === "dowel" && <Field label="קוטר דיבל"><Choice name="קוטר דיבל" disabled={disabled} options={opts(options("dowel_size"))} value={h.dowel_size} onChange={(v) => setH({ dowel_size: v })} /></Field>}
      </fieldset>
      <fieldset className="grid gap-4 rounded-xl border border-line p-4">
        <legend className="px-1 font-display text-lg">מגירות</legend>
        <Field label="סוג המערכת"><Choice name="סוג מערכת מגירה" disabled={disabled} options={opts(options("drawer_system"))} value={d.system_type}
          onChange={(v) => setD({ system_type: v, brand: undefined, model: undefined, model_custom: undefined })} /></Field>
        {d.system_type && <Field label="יצרן"><Choice name="יצרן מגירות" disabled={disabled} options={opts(brands)} value={d.brand}
          onChange={(v) => setD({ brand: v, model: undefined, model_custom: v === "generic" ? "" : undefined })} /></Field>}
        {models.length > 0 && <Field label="דגם"><Choice name="דגם מגירה" disabled={disabled} options={opts(models)} value={d.model} onChange={(v) => setD({ model: v })} /></Field>}
        {d.brand === "generic" && <Field label="דגם המגירה" id="drawer-custom">
          <input id="drawer-custom" className="field" disabled={disabled} value={d.model_custom ?? ""} onChange={(e) => setD({ model_custom: e.target.value })} placeholder="יצרן ודגם" /></Field>}
      </fieldset>
    </div>
  );
}

export function MaterialForm({ value, onChange, kind, disabled, carcass }:
  { value: MaterialSpec | FrontsSpec; onChange: (v: FrontsSpec) => void; kind: "carcass" | "fronts"; disabled?: boolean; carcass?: MaterialSpec }) {
  const { options } = useApp();
  const v = value as FrontsSpec;
  const same = kind === "fronts" && v.same_as_carcass;
  const set = (p: Partial<FrontsSpec>) => onChange({ ...v, ...p });
  const id = (s: string) => `${kind}-${s}`;
  return (
    <div className="grid gap-4">
      {kind === "fronts" && (
        <label className="flex items-center gap-2.5">
          <input type="checkbox" className="h-5 w-5 accent-slate" disabled={disabled} checked={!!v.same_as_carcass}
            onChange={(e) => set(e.target.checked ? { same_as_carcass: true, ...carcass } : { same_as_carcass: false })} />
          החזיתות מאותו חומר כמו גוף הארון
        </label>
      )}
      {!same && (<>
        <Field label="סוג חומר">
          <Choice name="סוג חומר" disabled={disabled} options={opts(options(kind === "carcass" ? "carcass_material" : "front_material"))}
            value={v.material_type} onChange={(m) => set({ material_type: m })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="קוד גוון / שם החומר" id={id("color")}>
            <input id={id("color")} className="field" disabled={disabled} value={v.color_code ?? ""} onChange={(e) => set({ color_code: e.target.value })} />
          </Field>
          <Field label="ספק / יבואן" id={id("imp")}>
            <select id={id("imp")} className="field" disabled={disabled} value={v.importer ?? ""} onChange={(e) => set({ importer: e.target.value || undefined })}>
              <option value="">לא צוין</option>
              {options("importer").map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </Field>
          {v.material_type !== "doors" && (
            <Field label="מידת פלטה" id={id("dim")}>
              <select id={id("dim")} className="field" disabled={disabled} value={v.board_dim ?? ""} onChange={(e) => set({ board_dim: e.target.value || undefined })}>
                <option value="">בחר מידה</option>
                {options("board_dim").map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </Field>
          )}
        </div>
        {v.importer === "other" && (
          <Field label="שם הספק" id={id("impo")}><input id={id("impo")} className="field" disabled={disabled} value={v.importer_other ?? ""} onChange={(e) => set({ importer_other: e.target.value })} /></Field>
        )}
      </>)}
    </div>
  );
}

/** Read-only summary of an order's spec, used in lists, order pages and exports. */
export function useSpecText() {
  const { label } = useApp();
  const hw = (h: HardwareSpec) => {
    const hinge = [label("hinge_brand", h.hinge?.brand), label("hinge_plate", h.hinge?.plate), label("hinge_fixation", h.hinge?.fixation), label("dowel_size", h.hinge?.dowel_size)].filter(Boolean).join(", ");
    const d = h.drawer ?? {};
    const drawer = [label("drawer_system", d.system_type), label("drawer_brand", d.brand), d.model ? label("drawer_model", d.model) : d.model_custom].filter(Boolean).join(", ");
    return { connection: label("connection_method", h.connection_method), hinge, drawer };
  };
  const mat = (m: MaterialSpec & { same_as_carcass?: boolean }, kind: "carcass" | "fronts" = "carcass"): string => {
    if (m.same_as_carcass) return "כמו גוף הארון";
    return [label(kind === "carcass" ? "carcass_material" : "front_material", m.material_type), m.color_code,
      m.importer === "other" ? m.importer_other : label("importer", m.importer), m.board_dim].filter(Boolean).join(", ");
  };
  return { hw, mat };
}

export function SpecSummary({ hardware, carcass, fronts }: { hardware: HardwareSpec; carcass: MaterialSpec; fronts: FrontsSpec }) {
  const { hw, mat } = useSpecText();
  const h = hw(hardware);
  const rows: [string, string][] = [["שיטת חיבור", h.connection], ["צירים", h.hinge], ["מגירות", h.drawer], ["גוף הארון", mat(carcass)], ["חזיתות", mat(fronts, "fronts")]];
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[9rem_1fr]">
      {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="font-semibold text-steel">{k}</dt><dd>{v || <span className="text-steel">לא נבחר</span>}</dd></div>))}
    </dl>
  );
}
