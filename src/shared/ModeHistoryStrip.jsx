// ── Mode history — a quiet monthly pattern, filed in Journals ────────
// One cell per day of the current month, coloured by that day's final state
// (God / Normal / Hell). Lives only here — never on the dashboard — so it's
// a pattern you review, not a metric you chase. No numbers, no score.
import { useMemo, useState } from "react";
import { AC2, T1, T2, T3, GL, BD, B2 } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { localDateStr } from "./dates.js";
import { sanitizeModeHistory } from "./modes.js";

const CELL = {
  god: { bg: `${AC2}30`, bd: `${AC2}66` },
  normal: { bg: GL, bd: BD },
  hell: { bg: "rgba(40,42,46,0.85)", bd: "#3A3E44" },
  none: { bg: "transparent", bd: "transparent" },
};
const WD = ["M", "T", "W", "T", "F", "S", "S"];

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-anchored
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

export function ModeHistoryStrip() {
  const [rawHistory] = useStorageState("mode_history", {});
  const history = useMemo(() => sanitizeModeHistory(rawHistory), [rawHistory]);
  const today = localDateStr();
  const [ym, setYm] = useState(() => { const [y, m] = today.split("-"); return { y: +y, m: +m - 1 }; });

  const cells = useMemo(() => monthMatrix(ym.y, ym.m), [ym]);
  const label = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const pad = (n) => String(n).padStart(2, "0");
  const step = (d) => setYm(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });

  const counts = useMemo(() => {
    const c = { god: 0, normal: 0, hell: 0 };
    for (const [k, v] of Object.entries(history)) if (k.startsWith(`${ym.y}-${pad(ym.m + 1)}`)) c[v.mode] = (c[v.mode] || 0) + 1;
    return c;
  }, [history, ym]);

  const link = { background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", fontFamily: "inherit" };

  return (
    <div style={{ border: `1px solid ${BD}`, borderRadius: 12, background: GL, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T1 }}>Day-state history</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => step(-1)} aria-label="Previous month" style={link}>‹</button>
          <span style={{ fontSize: 11.5, color: T2, minWidth: 108, textAlign: "center" }}>{label}</span>
          <button onClick={() => step(1)} aria-label="Next month" style={link}>›</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {WD.map((d, i) => <div key={i} style={{ fontSize: 9, color: T3, textAlign: "center", marginBottom: 2 }}>{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`;
          const rec = history[ds];
          const c = CELL[rec?.mode] || CELL.none;
          const isToday = ds === today;
          return (
            <div key={i} title={rec ? `${ds} · ${rec.mode}${rec.ambiguous ? " (borderline)" : ""}` : ds}
              style={{ aspectRatio: "1", borderRadius: 6, background: c.bg, border: `1px solid ${isToday ? AC2 : c.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: rec ? T1 : T3 }}>
              {d}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 11, fontSize: 10, color: T3, flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: CELL.god.bg, border: `1px solid ${CELL.god.bd}`, marginRight: 5 }} />God {counts.god}</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: CELL.normal.bg, border: `1px solid ${CELL.normal.bd}`, marginRight: 5 }} />Normal {counts.normal}</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: CELL.hell.bg, border: `1px solid ${CELL.hell.bd}`, marginRight: 5 }} />Hell {counts.hell}</span>
      </div>
    </div>
  );
}
