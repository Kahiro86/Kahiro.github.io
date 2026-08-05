// ── God Mode history — a quiet monthly pattern, filed in Journals ────
// One cell per day of the month, its gold intensity scaling with that day's
// final God Mode score. The 7-day average sits on top — the honest read of
// the week. Lives only here, never on the dashboard: a pattern you review,
// not a metric you chase.
import { useMemo, useState } from "react";
import { AC2, T1, T2, T3, GL, BD } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { localDateStr } from "./dates.js";
import { sanitizeModeHistory, sanitizeModeCfg, DEFAULT_MODE_CFG, dayTier, scoreColor, weekAverage } from "./modes.js";

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
  const [rawCfg] = useStorageState("mode_cfg", DEFAULT_MODE_CFG);
  const history = useMemo(() => sanitizeModeHistory(rawHistory), [rawHistory]);
  const cfg = useMemo(() => sanitizeModeCfg(rawCfg), [rawCfg]);
  const today = localDateStr();
  const [ym, setYm] = useState(() => { const [y, m] = today.split("-"); return { y: +y, m: +m - 1 }; });

  const cells = useMemo(() => monthMatrix(ym.y, ym.m), [ym]);
  const label = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const pad = (n) => String(n).padStart(2, "0");
  const step = (d) => setYm(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const weekAvg = useMemo(() => weekAverage(history, null, today, 7), [history, today]);

  const counts = useMemo(() => {
    const c = { full: 0, partial: 0, low: 0 };
    for (const [k, v] of Object.entries(history)) {
      if (!k.startsWith(`${ym.y}-${pad(ym.m + 1)}`)) continue;
      const t = dayTier(v.score, cfg);
      if (t) c[t] += 1;
    }
    return c;
  }, [history, ym, cfg]);

  const link = { background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 8px", fontFamily: "inherit" };

  return (
    <div style={{ border: `1px solid ${BD}`, borderRadius: 12, background: GL, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T1 }}>God Mode history</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => step(-1)} aria-label="Previous month" style={link}>‹</button>
          <span style={{ fontSize: 11.5, color: T2, minWidth: 108, textAlign: "center" }}>{label}</span>
          <button onClick={() => step(1)} aria-label="Next month" style={link}>›</button>
        </div>
      </div>
      {weekAvg != null && (
        <div style={{ fontSize: 11, color: T2, marginBottom: 10 }}>7-day average: <b style={{ color: scoreColor(weekAvg), fontFamily: "monospace" }}>{weekAvg}%</b></div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {WD.map((d, i) => <div key={i} style={{ fontSize: 9, color: T3, textAlign: "center", marginBottom: 2 }}>{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`;
          const rec = history[ds];
          const isToday = ds === today;
          const col = rec ? scoreColor(rec.score) : null;
          return (
            <div key={i} title={rec ? `${ds} · ${rec.score}%` : ds}
              style={{ aspectRatio: "1", borderRadius: 6, background: col ? `${col}2e` : "transparent", border: `1px solid ${isToday ? AC2 : col ? col + "66" : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: rec ? T1 : T3 }}>
              {d}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 11, fontSize: 10, color: T3, flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: `${scoreColor(95)}2e`, border: `1px solid ${scoreColor(95)}66`, marginRight: 5 }} />Full {counts.full}</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: `${scoreColor(78)}2e`, border: `1px solid ${scoreColor(78)}66`, marginRight: 5 }} />Partial {counts.partial}</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: `${scoreColor(40)}2e`, border: `1px solid ${scoreColor(40)}66`, marginRight: 5 }} />Low {counts.low}</span>
      </div>
    </div>
  );
}
