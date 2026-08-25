// ── Hydration & sleep, reported back ─────────────────────────────────
// Both were being logged and both paid XP, but neither had a view. This is
// the missing half of the chain: log → completion → trend → consistency.
import { useMemo } from "react";
import { Droplets, Moon } from "lucide-react";
import { BD, T1, T2, T3, AC, AC2, GR, AM } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { localDateStr } from "../../shared/dates.js";
import { hydrationSeries, sleepSeries, weeklyBuckets } from "../../shared/wellbeing.js";
import { useLinkedMetrics } from "../../shared/useLinkedMetrics.js";

function Track({ icon, s, fmt }) {
  const weeks = useMemo(() => weeklyBuckets(s, 6), [s]);
  const thin = (s.coverage ?? 0) < 60;
  return (
    <div style={{ border: `1px solid ${BD}`, borderRadius: 11, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T1, flex: 1 }}>{s.label}</span>
        <span style={{ fontSize: 10.5, color: T3, fontFamily: "'JetBrains Mono',monospace" }}>target {s.targetLabel}</span>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 11 }}>
        {[
          ["Consistency", s.consistency == null ? "—" : `${s.consistency}%`, s.consistency == null ? T3 : s.consistency >= 70 ? GR : AM],
          ["Average", s.average == null ? "—" : fmt(s.average), T1],
          ["Days hit", `${s.hits}/${s.loggedDays}`, T2],
        ].map(([l, v, c]) => (
          <div key={l}>
            <div style={{ fontSize: 17, fontWeight: 700, color: c, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
            <div style={{ fontSize: 9, color: T3, letterSpacing: 0.9, textTransform: "uppercase", marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Daily bars. A day with no log is a gap, drawn as a gap. */}
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 34 }}>
        {s.rows.map((r) => {
          const h = r.value == null ? 0 : Math.min(100, (r.value / Math.max(1, s.target)) * 100);
          return (
            <div key={r.d} title={`${r.d} · ${r.value == null ? "not logged" : fmt(r.value)}`}
              style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column-reverse",
                background: r.value == null ? "transparent" : "rgba(255,255,255,0.03)",
                border: r.value == null ? `1px dashed ${BD}` : "none", borderRadius: 2, overflow: "hidden" }}>
              {r.value != null && <div style={{ height: `${Math.max(6, h)}%`, background: r.hit ? GR : AM, borderRadius: 2 }} />}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", fontSize: 10, color: T3, fontFamily: "'JetBrains Mono',monospace" }}>
        {weeks.map((w, i) => (
          <span key={i}>{w.label} {w.consistency == null ? "—" : `${w.consistency}%`}</span>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: thin ? AM : T3, marginTop: 9, paddingTop: 8, borderTop: `1px solid ${BD}`, lineHeight: 1.5 }}>
        {s.loggedDays} of {s.days} days logged{thin ? " — too thin to read as a rate" : ""}. Unlogged days are gaps, not misses.
      </div>
    </div>
  );
}

export function Wellbeing({ days = 30 }) {
  const [nutrition] = useStorageState("nutrition_log", {});
  const [nutritionProfile] = useStorageState("nutrition_profile", {});
  const [sleep] = useStorageState("trade_sleep", {});
  const today = localDateStr();

  const { hydration, claims } = useLinkedMetrics();
  const hyd = useMemo(() => hydrationSeries({ nutrition, nutritionProfile, hydration, claims: claims.hydration, today, days }), [nutrition, nutritionProfile, hydration, claims.hydration, today, days]);
  const slp = useMemo(() => sleepSeries({ sleep, claims: claims.sleep, today, days }), [sleep, claims.sleep, today, days]);

  return (
    <Card style={{ padding: "16px 18px" }}>
      <SH title="Hydration & sleep" sub={`Last ${days} days · logged against your own targets`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginTop: 12 }}>
        <Track icon={<Droplets size={14} color={AC2} />} s={hyd} fmt={(v) => `${(v / 1000).toFixed(1)} L`} />
        <Track icon={<Moon size={14} color={AC} />} s={slp} fmt={(v) => `${v} h`} />
      </div>
    </Card>
  );
}
