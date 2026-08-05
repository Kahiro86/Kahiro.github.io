// ── Weekly muscle rollup — the file-based Journals record of what got
// trained this week. A body map of the union worked, plus per-group counts
// and how long since each was last hit, so gaps (e.g. "no arm work in 9 days")
// are visible at a glance without tallying by hand. Reads the same single
// source of truth (athlete_workouts) — never a live dashboard element.
import { useMemo } from "react";
import { T1, T2, T3, GL, BD, AC2, GR, AM } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { localDateStr, daysAgoStr } from "./dates.js";
import { muscleRollup, ALL_MUSCLES } from "./workoutLog.js";
import { BodyMap } from "./BodyMap.jsx";

export function WeeklyMuscleRollup() {
  const [rawWorkouts] = useStorageState("athlete_workouts", []);
  const ds = localDateStr();
  // Monday of the current week → today.
  const dow = new Date(`${ds}T12:00:00`).getDay(); // 0 = Sun
  const monday = daysAgoStr((dow + 6) % 7);

  const rows = useMemo(() => {
    const week = muscleRollup(rawWorkouts, monday, ds, ds);              // counts this week
    const all = muscleRollup(rawWorkouts, "0000-01-01", ds, ds);         // gap over all history
    const gap = Object.fromEntries(all.map((r) => [r.muscle, r.daysSince]));
    return week.map((r) => ({ ...r, daysSince: gap[r.muscle] }));
  }, [rawWorkouts, monday, ds]);

  const workedThisWeek = rows.filter((r) => r.count > 0).map((r) => r.muscle);
  const anyEver = rows.some((r) => r.daysSince != null);
  if (!anyEver && !workedThisWeek.length) return null; // nothing logged yet — stay hidden

  const gapWord = (r) => {
    if (r.count > 0) return `${r.count}× this week`;
    if (r.daysSince == null) return "not yet logged";
    return `${r.daysSince}d ago`;
  };
  const gapColor = (r) => {
    if (r.count > 0) return GR;
    if (r.daysSince == null || r.daysSince >= 9) return AM; // a real gap worth seeing
    return T3;
  };

  return (
    <div style={{ border: `1px solid ${BD}`, borderRadius: 12, background: GL, padding: "14px 15px", marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, color: T3, marginBottom: 4 }}>This week · muscles trained</div>
      <div style={{ fontSize: 11, color: T3, marginBottom: 10 }}>Week of {monday} → today</div>
      <BodyMap muscles={workedThisWeek} size={190}
        caption={workedThisWeek.length ? undefined : "No workouts logged yet this week."} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 7, marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.muscle} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 9px", background: "rgba(255,255,255,0.02)", border: `1px solid ${r.count > 0 ? AC2 + "33" : BD}`, borderRadius: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.count > 0 ? AC2 : (r.daysSince != null && r.daysSince >= 9 ? AM : T3), flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, color: T1, textTransform: "capitalize" }}>{r.muscle}</span>
            <span style={{ fontSize: 10.5, color: gapColor(r), fontFamily: "monospace" }}>{gapWord(r)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
