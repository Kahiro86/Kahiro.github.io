// ── Cross-module insights, on screen (spec §5.2) ─────────────────────
// A renderer. Every sentence comes from crossModule.js, which is where the
// evidence rules live — so there is one place where a finding's wording can
// change, and one place to audit it.
import { useMemo } from "react";
import { Link2, AlertCircle } from "lucide-react";
import { BD, T1, T2, T3, AC, AC2, GR, AM } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { localDateStr } from "../../shared/dates.js";
import { crossModuleInsights } from "../../shared/crossModule.js";

export function CrossInsights({ days = 30 }) {
  const [htHabits] = useStorageState("ht_habits", []);
  const [htEntries] = useStorageState("ht_entries", []);
  const [legacyHabits] = useStorageState("habits", []);
  const [sleep] = useStorageState("trade_sleep", {});
  const [nutrition] = useStorageState("nutrition_log", {});
  const [nutritionProfile] = useStorageState("nutrition_profile", {});
  const [gymSessions] = useStorageState("gym_sessions", []);
  const [workouts] = useStorageState("athlete_workouts", []);
  const today = localDateStr();

  const { insights, computed } = useMemo(
    () => crossModuleInsights({ htHabits, htEntries, legacyHabits, sleep, nutrition, nutritionProfile, gymSessions, workouts, today, days }),
    [htHabits, htEntries, legacyHabits, sleep, nutrition, nutritionProfile, gymSessions, workouts, today, days],
  );

  return (
    <Card style={{ padding: "16px 18px" }}>
      <SH title="Across domains" sub={`Last ${days} days · ${computed} of ${insights.length} computable from your data`} />
      <div style={{ fontSize: 11.5, color: T3, margin: "9px 0 14px", lineHeight: 1.6 }}>
        None of these can be worked out from one part of the app. They are the reason the domains sit together.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {insights.map((i) => {
          const thin = i.status !== "computed";
          const tone = thin ? T3 : Math.abs(i.gap ?? 0) >= 15 ? AC : AC2;
          return (
            <div key={i.id} style={{ border: `1px solid ${thin ? BD : `${tone}33`}`, background: thin ? "transparent" : `${tone}08`, borderRadius: 11, padding: "13px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {thin ? <AlertCircle size={13} color={T3} /> : <Link2 size={13} color={tone} />}
                <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: tone, fontWeight: 700 }}>
                  {i.law ? `Law ${i.law.n}` : i.rule}
                </span>
                {i.law && <span style={{ fontSize: 11.5, color: T2, fontStyle: "italic" }}>{i.law.title}</span>}
              </div>

              <div style={{ fontSize: 13.5, color: thin ? T3 : T1, lineHeight: 1.6 }}>{i.text}</div>

              {i.law && !thin && (
                <div style={{ fontSize: 11, color: T3, marginTop: 7, lineHeight: 1.5 }}>{i.law.body}</div>
              )}

              {/* Evidence is not a footnote — an insight that hides how much it
                  looked at is asking to be trusted on presentation alone. */}
              <div style={{ fontSize: 10.5, color: T3, marginTop: 9, paddingTop: 8, borderTop: `1px solid ${BD}`, fontFamily: "'JetBrains Mono',monospace" }}>
                {i.evidence}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
