import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { localDateStr } from "./dates.js";
import { B2, BD, BD2, T1, T2, T3 } from "./designTokens.js";

// ── Progress ring — daily rings on Command Center and Life OS ───────
export function Ring({ pct, size = 128, stroke = 10, color, glow = false, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BD} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(Math.min(100, pct || 0) / 100) * c} ${c}`}
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)", filter: glow ? `drop-shadow(0 0 8px ${color}66)` : undefined }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

// ── Donut / pie summary chart ──────────────────────────────────────
export function DonutChart({ data, height = 190, centerLabel, centerSub, unit = "" }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="none">
            {data.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.9} />)}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div style={{ background: B2, border: `1px solid ${BD2}`, borderRadius: 8, padding: "7px 11px", fontSize: 12 }}>
                  <span style={{ color: payload[0].payload.color, fontWeight: 700 }}>{payload[0].name}</span>
                  <span style={{ color: T2, marginLeft: 8, fontFamily: "monospace" }}>
                    {unit}{Math.round(payload[0].value).toLocaleString()}{total > 0 ? ` · ${Math.round((payload[0].value / total) * 100)}%` : ""}
                  </span>
                </div>
              ) : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel !== undefined) && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: T1, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{centerLabel}</div>
          {centerSub && <div style={{ fontSize: 9, color: T3, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>{centerSub}</div>}
        </div>
      )}
    </div>
  );
}

// ── Legend row for a donut ──────────────────────────────────────────
export function ChartLegend({ data, fmt }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
      {data.map((d) => (
        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: T2, flex: 1 }}>{d.name}</span>
          <span style={{ fontSize: 11, color: T3 }}>{total > 0 ? `${Math.round((d.value / total) * 100)}%` : "—"}</span>
          <span style={{ fontSize: 11.5, color: d.color, fontFamily: "monospace", fontWeight: 700, minWidth: 44, textAlign: "right" }}>
            {fmt ? fmt(d.value) : Math.round(d.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── GitHub-style activity heatmap ───────────────────────────────────
// `counts` is a Map/object of "YYYY-MM-DD" -> intensity number.
export function ActivityHeatmap({ counts, weeks = 13, color = "#00D4FF", emptyColor = BD }) {
  const get = (k) => (counts instanceof Map ? counts.get(k) : counts[k]) || 0;
  const today = new Date();
  // End on the Saturday of the current week so columns are whole weeks.
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const totalDays = weeks * 7;
  const start = new Date(end);
  start.setDate(start.getDate() - (totalDays - 1));

  const cells = [];
  let max = 1;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = localDateStr(d);
    const c = get(key);
    if (c > max) max = c;
    cells.push({ key, date: d, count: c, future: d > today });
  }
  // Columns = weeks, rows = weekday.
  const cols = [];
  for (let w = 0; w < weeks; w++) cols.push(cells.slice(w * 7, w * 7 + 7));

  const shade = (c) => {
    if (c <= 0) return emptyColor;
    const t = 0.25 + 0.75 * Math.min(c / max, 1);
    return `${color}${Math.round(t * 255).toString(16).padStart(2, "0")}`;
  };

  const DOW = ["S", "M", "T", "W", "T", "F", "S"];
  const monthLabels = cols.map((col) => {
    const first = col[0].date;
    return first.getDate() <= 7 ? first.toLocaleDateString("en-US", { month: "short" }) : "";
  });

  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 16 }}>
        {DOW.map((d, i) => (
          <div key={i} style={{ width: 10, height: 12, fontSize: 8, color: T3, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {i % 2 === 1 ? d : ""}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", gap: 3, height: 13 }}>
          {monthLabels.map((m, i) => (
            <div key={i} style={{ width: 12, fontSize: 8, color: T3, whiteSpace: "nowrap" }}>{m}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {cols.map((col, ci) => (
            <div key={ci} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {col.map((cell) => (
                <div
                  key={cell.key}
                  title={`${cell.key}: ${cell.count} ${cell.count === 1 ? "activity" : "activities"}`}
                  style={{ width: 12, height: 12, borderRadius: 3, background: cell.future ? "transparent" : shade(cell.count), border: cell.future ? "none" : `1px solid ${cell.count > 0 ? "transparent" : BD}` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
