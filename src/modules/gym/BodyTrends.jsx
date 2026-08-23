// ── Body · Trends (spec §2.1 B) ──────────────────────────────────────
// Weight, waist, strength and adherence share one x-axis. The point is that a
// flat weight line next to a falling waist line reads as recomposition on
// sight — which it cannot do if the two live on separate screens.
import { useMemo } from "react";
import { B2, BD, T1, T2, T3, AC, AC2, GR, AM, PU, CY } from "../../shared/designTokens.js";
import { Card, SH, Empty } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { localDateStr } from "../../shared/dates.js";
import { sanitizeNutrition, sanitizeProfile } from "../athlete/nutrition.js";
import { bodyTimeline, plottable } from "./bodyTrends.js";

const SERIES = [
  { k: "weightKg", l: "Weight", u: "kg", c: AC },
  { k: "waistCm", l: "Waist", u: "cm", c: PU },
  { k: "tonnage", l: "Tonnage", u: "kg/session", c: AC2 },
  { k: "kcalAdherence", l: "Calories vs target", u: "%", c: GR },
  { k: "proteinAdherence", l: "Protein vs target", u: "%", c: CY },
];

// One row per series, drawn against its own min/max so shape is comparable
// even though the units are not. The numbers stay on the labels.
function Sparkline({ points, color, height = 34 }) {
  const vals = points.map((p) => p.v).filter((v) => v != null);
  if (vals.length < 2) return <div style={{ height, display: "flex", alignItems: "center", fontSize: 10.5, color: T3 }}>not enough points yet</div>;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const w = 100, step = points.length > 1 ? w / (points.length - 1) : w;
  let d = "", started = false;
  points.forEach((p, i) => {
    if (p.v == null) { started = false; return; }
    const x = i * step;
    const y = height - 3 - ((p.v - min) / span) * (height - 6);
    d += `${started ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    started = true;
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height, display: "block" }}>
      <path d={d.trim()} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => p.v == null ? null : (
        <circle key={i} cx={i * step} cy={height - 3 - ((p.v - min) / span) * (height - 6)} r={1.6} fill={color} />
      ))}
    </svg>
  );
}

export function BodyTrends({ sessions }) {
  const [rawLog] = useStorageState("nutrition_log", {});
  const [rawProfile] = useStorageState("nutrition_profile", {});
  const [measurements] = useStorageState("athlete_measurements", []);
  const today = localDateStr();

  const log = useMemo(() => sanitizeNutrition(rawLog), [rawLog]);
  const profile = useMemo(() => sanitizeProfile(rawProfile), [rawProfile]);
  const timeline = useMemo(
    () => bodyTimeline({ log, profile, sessions, measurements, today, weeks: 12 }),
    [log, profile, sessions, measurements, today],
  );
  const can = useMemo(() => plottable(timeline), [timeline]);
  const anything = Object.values(can).some(Boolean);

  const totalLogged = timeline.reduce((s, b) => s + b.loggedDays, 0);
  const totalSessions = timeline.reduce((s, b) => s + b.sessions, 0);

  if (!anything) {
    return (
      <div style={{ padding: "20px 24px", maxWidth: 900 }}>
        <Empty icon="📈" title="Not enough history yet"
          sub="Trends need at least two weeks with data. Log sessions, meals or a measurement and the timeline fills in." />
      </div>
    );
  }

  const last = timeline[timeline.length - 1];
  const first = timeline.find((b) => b.weightKg != null) || null;

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 900 }}>
      <div style={{ fontSize: 11.5, color: T2 }}>
        Last 12 weeks · {totalSessions} sessions · {totalLogged} days of food logged
      </div>

      <Card style={{ padding: "16px 18px" }}>
        <SH title="One timeline" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {SERIES.filter((s) => can[s.k]).map((s) => {
            const points = timeline.map((b) => ({ v: b[s.k] }));
            const vals = points.map((p) => p.v).filter((v) => v != null);
            const now = vals[vals.length - 1], then = vals[0];
            const delta = Math.round((now - then) * 10) / 10;
            return (
              <div key={s.k}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s.c, flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: T2, flex: 1 }}>{s.l}</span>
                  <span style={{ fontSize: 11.5, color: T1, fontFamily: "'JetBrains Mono',monospace" }}>{now}{s.u === "%" ? "%" : ` ${s.u}`}</span>
                  <span style={{ fontSize: 10, color: T3, fontFamily: "monospace", minWidth: 52, textAlign: "right" }}>
                    {delta === 0 ? "flat" : `${delta > 0 ? "+" : ""}${delta} / 12wk`}
                  </span>
                </div>
                <Sparkline points={points} color={s.c} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9.5, color: T3, fontFamily: "monospace" }}>
          <span>{timeline[0].label}</span><span>{last.label}</span>
        </div>
      </Card>

      {/* Weeks are only comparable when they carry comparable data — say so. */}
      <Card style={{ padding: "14px 16px" }}>
        <SH title="Coverage by week" />
        <div style={{ display: "flex", gap: 4, marginTop: 10, alignItems: "flex-end" }}>
          {timeline.map((b) => (
            <div key={b.end} title={`${b.label} · ${b.loggedDays}/7 days logged · ${b.sessions} sessions`} style={{ flex: 1 }}>
              <div style={{ height: 34, background: B2, border: `1px solid ${BD}`, borderRadius: 4, display: "flex", flexDirection: "column-reverse", overflow: "hidden" }}>
                <div style={{ height: `${(b.loggedDays / 7) * 100}%`, background: b.loggedDays >= 5 ? `${GR}88` : b.loggedDays >= 3 ? `${AM}88` : `${AM}33` }} />
              </div>
              <div style={{ fontSize: 8, color: T3, textAlign: "center", marginTop: 3, fontFamily: "monospace" }}>{b.sessions}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: T3, marginTop: 8, lineHeight: 1.5 }}>
          Bar = days of food logged that week; number = sessions. A short bar means that week's averages above are a sketch, not a measurement.
        </div>
      </Card>

      {first && last.weightKg != null && first !== last && (
        <div style={{ fontSize: 11, color: T2, lineHeight: 1.6 }}>
          Weight {first.weightKg} → {last.weightKg} kg
          {first.waistCm != null && last.waistCm != null ? ` · waist ${first.waistCm} → ${last.waistCm} cm` : ""} across the plotted window.
        </div>
      )}
    </div>
  );
}
