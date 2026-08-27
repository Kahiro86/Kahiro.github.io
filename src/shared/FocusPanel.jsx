// ── Focus, on the today surface ──────────────────────────────────────
// Two short lists and nothing else. The rules live in focus.js; this only
// renders what they found, and renders nothing at all when they found
// nothing — a panel that fills itself with filler on a quiet week teaches
// people to stop reading it.
import { useMemo } from "react";
import { ArrowUpRight, Ban } from "lucide-react";
import { BD, T1, T2, T3, GL, GR, AM } from "./designTokens.js";
import { Card, SH } from "./ui.jsx";
import { useStorageState } from "./useStorageState.js";
import { useWorkouts } from "./useWorkouts.js";
import { buildActivityFeed } from "./activity.js";
import { focusFindings } from "./focus.js";

export function FocusPanel({ onNavigate }) {
  const [htHabits] = useStorageState("ht_habits", []);
  const [htEntries] = useStorageState("ht_entries", []);
  const [nutrition] = useStorageState("nutrition_log", {});
  const [nutritionProfile] = useStorageState("nutrition_profile", null);
  const [hydration] = useStorageState("hydration_log", {});
  const [sleep] = useStorageState("trade_sleep", {});
  const [church] = useStorageState("faith_church", []);
  const [verses] = useStorageState("faith_scripture", []);
  const [faithNotes] = useStorageState("faith_notes", []);
  const [entries] = useStorageState("journal_entries", []);
  const [purity] = useStorageState("purity_log", {});
  const workouts = useWorkouts();

  const feed = useMemo(() => buildActivityFeed({
    htHabits, htEntries, workouts, nutrition, nutritionProfile, hydration,
    sleep, church, verses, faithNotes, entries, purity,
  }), [htHabits, htEntries, workouts, nutrition, nutritionProfile, hydration, sleep, church, verses, faithNotes, entries, purity]);

  const { more, avoid, evidence } = useMemo(() => focusFindings(feed), [feed]);

  // Nothing worth saying is a legitimate answer, and on a first run it is the
  // only honest one.
  if (!more.length && !avoid.length) {
    if (evidence.enough) return null;
    return null;
  }

  const row = (f, tone, Icon) => (
    <div key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0" }}>
      <Icon size={12} color={tone} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ fontSize: 12.5, color: T2, lineHeight: 1.5 }}>{f.text}</span>
    </div>
  );

  return (
    <Card>
      <SH title="Focus" sub={`From the last ${evidence.days} days · ${evidence.loggedDays} recorded`} />
      {more.length > 0 && (
        <div style={{ marginBottom: avoid.length ? 12 : 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: T3, fontWeight: 700, marginBottom: 3 }}>Do more</div>
          {more.map((f) => row(f, GR, ArrowUpRight))}
        </div>
      )}
      {avoid.length > 0 && (
        <div style={{ borderTop: more.length ? `1px solid ${BD}` : "none", paddingTop: more.length ? 10 : 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: T3, fontWeight: 700, marginBottom: 3 }}>Avoid</div>
          {avoid.map((f) => row(f, AM, Ban))}
        </div>
      )}
    </Card>
  );
}
