// ── Session phases editor ────────────────────────────────────────────
// The fourteen windows of the trading day, plus Custom.
//
// You edit a phase's offset from its session open, not a wall-clock
// string. That is what a phase actually is — "the first hour of London" —
// and it is why the clock column can shift itself twice a year without
// you touching anything.
import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { BD, T1, T2, T3, AC, AC2, GR, AM, RE, MONO } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { localDateStr } from "../../shared/dates.js";
import {
  SESSIONS, TRADEABLE, phaseWindowLabel, sessionOpenEat, toHHMM,
  isEuDst, isUsDst, DISPLAY_TZ,
} from "./engine/phases.js";

const TONE = { Yes: GR, Selective: AM, Avoid: RE };

export function PhasesTab({ phases, setPhases, trades }) {
  const today = localDateStr();
  const [preview, setPreview] = useState(today);

  // How many trades sit in each phase — so an "Avoid" window you keep
  // trading is visible here, not only three charts away.
  const counts = useMemo(() => {
    const m = {};
    for (const t of trades) if (t.phaseId) m[t.phaseId] = (m[t.phaseId] || 0) + 1;
    return m;
  }, [trades]);

  const edit = (id, patch) =>
    setPhases((prev) => (Array.isArray(prev) ? prev : phases).map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const londonDst = isEuDst(preview);
  const nyDst = isUsDst(preview);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Clock size={13} style={{ color: AC }} />
          <span style={{ fontSize: 12, color: T1, fontWeight: 600 }}>Clock shown for</span>
          <input
            type="date" value={preview} onChange={(e) => setPreview(e.target.value || today)}
            style={{
              background: "transparent", border: `1px solid ${BD}`, borderRadius: 8,
              color: T1, padding: "5px 9px", fontSize: 11.5, fontFamily: MONO, colorScheme: "dark",
            }}
          />
          <span style={{ fontSize: 11, color: T3 }}>{DISPLAY_TZ}</span>
        </div>
        {/* The DST fix, stated rather than assumed. */}
        <div style={{ fontSize: 10.5, color: T3, lineHeight: 1.6 }}>
          Times are computed from each session's real open —{" "}
          <span style={{ color: T2 }}>{SESSIONS.Asian.label}</span>,{" "}
          <span style={{ color: T2 }}>{SESSIONS.London.label}</span>,{" "}
          <span style={{ color: T2 }}>{SESSIONS["New York"].label}</span> — so they follow daylight
          saving on their own. On this date London is on{" "}
          <span style={{ color: AC2 }}>{londonDst ? "summer time" : "winter time"}</span> (opens{" "}
          {toHHMM(sessionOpenEat("London", preview))}) and New York on{" "}
          <span style={{ color: AC2 }}>{nyDst ? "daylight time" : "standard time"}</span> (opens{" "}
          {toHHMM(sessionOpenEat("New York", preview))}). Nothing to edit in November.
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 720 }}>
            <thead>
              <tr style={{ color: T3, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.7 }}>
                {["Phase", "Session", "Window", "From open", "Tradeable", "Trades", "Typical behaviour"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${BD}`, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${BD}` }}>
                  <td style={{ padding: "9px 12px", color: T1, fontWeight: 600, fontFamily: MONO }}>{p.phase}</td>
                  <td style={{ padding: "9px 12px", color: T2 }}>{p.session}</td>
                  <td style={{ padding: "9px 12px", color: AC, fontFamily: MONO, whiteSpace: "nowrap" }}>
                    {phaseWindowLabel(p, preview)}
                  </td>
                  <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                    {p.startOffset == null ? (
                      <span style={{ color: T3 }}>—</span>
                    ) : (
                      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                        {["startOffset", "endOffset"].map((k, i) => (
                          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {i === 1 && <span style={{ color: T3 }}>→</span>}
                            <input
                              type="number" step={15} value={p[k]}
                              onChange={(e) => edit(p.id, { [k]: Math.round(+e.target.value || 0) })}
                              style={{
                                width: 58, background: "transparent", border: `1px solid ${BD}`,
                                borderRadius: 6, color: T1, padding: "3px 6px", fontSize: 11, fontFamily: MONO,
                              }}
                            />
                          </span>
                        ))}
                        <span style={{ color: T3, fontSize: 10 }}>min</span>
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "9px 12px" }}>
                    <select
                      value={p.tradeable} onChange={(e) => edit(p.id, { tradeable: e.target.value })}
                      style={{
                        background: "transparent", border: `1px solid ${BD}`, borderRadius: 6,
                        color: TONE[p.tradeable] || T2, padding: "3px 6px", fontSize: 11, fontWeight: 600,
                        fontFamily: "inherit",
                      }}
                    >
                      {TRADEABLE.map((o) => <option key={o} value={o} style={{ background: "#161616" }}>{o}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "9px 12px", fontFamily: MONO, color: counts[p.id] ? T1 : T3 }}>
                    {counts[p.id] || 0}
                  </td>
                  <td style={{ padding: "9px 12px", color: T3, lineHeight: 1.5, minWidth: 260 }}>{p.behaviour}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
