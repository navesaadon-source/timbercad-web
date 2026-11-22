import sheet from "@/assets/sample-sheet.json";

/** A real nesting layout from a TimberCad job, drawn as the CNC would cut it. */
export default function SheetArt({ animate = true }: { animate?: boolean }) {
  const { L, W, parts } = sheet as { L: number; W: number; parts: { r: number[]; n: string; k: string }[] };
  const order = [...parts].sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1]);
  return (
    <svg viewBox={`-30 -30 ${L + 60} ${W + 60}`} className="h-auto w-full" role="img"
      aria-label={`פריסת פלטה ${L}×${W} מ״מ עם ${parts.length} חלקים`}>
      <rect x="0" y="0" width={L} height={W} rx="6" fill="#fff" stroke="#9aa6ad" strokeWidth="5" />
      {order.map((p, i) => {
        const [x, y, w, h] = p.r;
        const len = 2 * (w + h);
        const fs = Math.max(20, Math.min(54, Math.min(w, h) / 3.2, w / 6.5));
        const style = { "--len": len, "--d": `${0.25 + i * 0.12}s` } as React.CSSProperties;
        return (
          <g key={p.k}>
            <rect x={x} y={y} width={w} height={h} rx="3" className={animate ? "cut-fill" : ""} style={style} fill="#efe0c6" />
            <rect x={x} y={y} width={w} height={h} rx="3" fill="none" stroke="#e8611a" strokeWidth="5" className={animate ? "cut-path" : ""} style={style} />
            {Math.min(w, h) > 120 && (
              <text x={x + w / 2} y={y + h / 2} fontSize={fs} textAnchor="middle" dominantBaseline="middle" fill="#1f2b33"
                className={animate ? "cut-fill" : ""} style={style} fontFamily="Assistant, Arial">
                {p.n}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
