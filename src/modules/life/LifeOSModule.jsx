import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Sun, ListChecks, Layers, TrendingUp, BookOpen, Plus, Check, Flame, SkipForward,
  Pencil, Copy, Archive, ArchiveRestore, Trash2, Pause, Play, Star, Trophy, FolderKanban, ShieldCheck,
} from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip, Hydrating } from "../../shared/ui.jsx";
import { Collapse } from "../../shared/Collapse.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { ActivityHeatmap } from "../../shared/charts.jsx";
import { REFLECTION_PROMPTS } from "../../shared/kaizen.js";
import {
  newHabit, newRoutine, isScheduled, isDone, isSkipped, valueOn, tapHabit, toggleSkip, setHabitValue,
  currentStreak, longestStreak, rangeStats, totalCompletions, perfectDays,
  xpOf, levelOf, xpForLevel, badges, completeRoutine, routineProgress,
  isWeekly, weekProgress, weeklyStreak, isWellness, isNonNeg, makeNonNeg, makeWellness,
} from "../../shared/habitEngine.js";
import { HabitEditor } from "./HabitEditor.jsx";
import { WellnessPanel } from "./WellnessPanel.jsx";
import { NonNegotiables } from "./NonNegotiables.jsx";
import { PurityTab } from "./PurityTab.jsx";

const today = () => localDateStr();

// ── Progress ring ────────────────────────────────────────────────────
function Ring({ pct, size = 128, stroke = 10, color = GR, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BD} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 8px ${color}66)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export function LifeOSModule({ habits, setHabits, loaded = true, onNavigate }) {
  const [tab, setTab] = useState("today");
  const [editing, setEditing] = useState(null);         // habit being edited or newHabit()
  const [rawRoutines, setRoutines] = useStorageState("routines", []);
  const [routineDraft, setRoutineDraft] = useState(null);
  const [insightHabit, setInsightHabit] = useState(null);
  const [journal, setJournal] = useState("");
  const [rawEntries, setEntries] = useStorageState("journal_entries", []);
  const [rawProjects, setProjects] = useStorageState("life_projects", []);
  const [projectDraft, setProjectDraft] = useState("");
  const toast = useToast();

  // Stored records can be corrupt (null entries, habitIds missing) — sanitise
  // once at the read point so every render below can trust the shape.
  const routines = useMemo(
    () => (Array.isArray(rawRoutines) ? rawRoutines : [])
      .filter((r) => r && typeof r === "object" && r.id)
      .map((r) => (Array.isArray(r.habitIds) ? r : { ...r, habitIds: [] })),
    [rawRoutines]
  );
  const entries = useMemo(
    () => (Array.isArray(rawEntries) ? rawEntries : []).filter((e) => e && typeof e === "object" && e.id),
    [rawEntries]
  );
  const projects = useMemo(
    () => (Array.isArray(rawProjects) ? rawProjects : []).filter((p) => p && typeof p === "object" && p.id),
    [rawProjects]
  );

  const active = habits.filter((h) => !h.archived);
  const ds = today();

  // Pillar groupings — surfaced in dedicated sections, not the category list.
  const wellnessHabits = active.filter(isWellness);
  const nonNegHabits = active.filter((h) => isNonNeg(h) && !isWeekly(h));
  const weeklyHabits = active.filter(isWeekly);

  // Today's schedule (all daily habits feed the ring; pillars render separately)
  const scheduledToday = active.filter((h) => isScheduled(h, ds));
  const catHabitsToday = scheduledToday.filter((h) => !isWellness(h) && !isNonNeg(h));
  const categories = [...new Set(catHabitsToday.map((h) => h.category))];
  const doneToday = scheduledToday.filter((h) => isDone(h, ds));
  const skippedToday = scheduledToday.filter((h) => isSkipped(h, ds) && !isDone(h, ds));
  const pctToday = scheduledToday.length ? Math.round((doneToday.length / scheduledToday.length) * 100) : 0;
  const xp = useMemo(() => xpOf(habits), [habits]);
  const level = levelOf(xp);
  const nextXp = xpForLevel(level + 1);
  const prevXp = xpForLevel(level);
  const badgeList = useMemo(() => badges(habits), [habits]);

  // ── Actions ────────────────────────────────────────────────────────
  const tap = (h) => {
    const wasPerfect = scheduledToday.length && scheduledToday.every((x) => isDone(x, ds));
    setHabits((prev) => tapHabit(prev, h.id));
    if (!isDone(h, ds)) {
      const willBeDone = valueOn(h, ds) + 1 >= (h.target || 1);
      const remaining = scheduledToday.filter((x) => x.id !== h.id && !isDone(x, ds) && !isSkipped(x, ds)).length;
      if (willBeDone && remaining === 0 && !wasPerfect && scheduledToday.length > 1) {
        toast("⭐ Perfect day — every habit complete. This is how it compounds.", { tone: "success", duration: 6000 });
      }
    }
  };
  const skip = (h) => setHabits((prev) => toggleSkip(prev, h.id));
  const setValue = (id, v) => setHabits((prev) => setHabitValue(prev, id, v));
  const tapId = (id) => setHabits((prev) => tapHabit(prev, id));
  const addStarterPack = (kind) => {
    const has = habits.some((h) => (kind === "nonneg" ? isNonNeg(h) : isWellness(h)) && !h.archived);
    if (has) { toast(`${kind === "nonneg" ? "Non-Negotiables" : "Wellness"} already set up`, { tone: "info" }); return; }
    setHabits((prev) => [...prev, ...(kind === "nonneg" ? makeNonNeg() : makeWellness())]);
    toast(`${kind === "nonneg" ? "Non-Negotiables" : "Wellness trackers"} added 🌿`, { tone: "success" });
  };
  const saveHabit = (h) => {
    setHabits((prev) => (prev.some((x) => x.id === h.id) ? prev.map((x) => (x.id === h.id ? { ...x, ...h } : x)) : [...prev, h]));
    setEditing(null);
  };
  const patchHabit = (id, patch) => setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const deleteHabit = (h) => {
    setHabits((prev) => prev.filter((x) => x.id !== h.id));
    toast(`"${h.name}" deleted`, { action: "Undo", onAction: () => setHabits((p) => [...p, h]), tone: "danger" });
  };
  const duplicateHabit = (h) => {
    const { id: _id, log: _log, ...rest } = h;
    setHabits((prev) => [...prev, newHabit({ ...rest, name: `${h.name} (copy)`, log: {}, createdAt: today() })]);
  };
  const runRoutine = (r) => {
    setHabits((prev) => completeRoutine(prev, r));
    toast(`${r.icon} ${r.name} complete — every habit logged`, { tone: "success" });
  };
  const saveRoutine = () => {
    if (!routineDraft.name.trim() || !routineDraft.habitIds.length) return;
    setRoutines((prev) => (prev.some((x) => x.id === routineDraft.id) ? prev.map((x) => (x.id === routineDraft.id ? routineDraft : x)) : [...prev, routineDraft]));
    setRoutineDraft(null);
  };
  const deleteRoutine = (r) => {
    setRoutines((prev) => prev.filter((x) => x.id !== r.id));
    toast(`Routine "${r.name}" deleted`, { action: "Undo", onAction: () => setRoutines((p) => [...p, r]), tone: "danger" });
  };
  const saveEntry = () => {
    if (!journal.trim()) return;
    setEntries((prev) => [{ id: `j${Date.now()}`, date: new Date().toISOString(), text: journal }, ...prev]);
    setJournal("");
    toast("Reflection saved 🌱", { tone: "success", duration: 2500 });
  };
  const deleteEntry = (id) => {
    const entry = entries.find((e) => e.id === id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast("Entry deleted", { action: "Undo", onAction: () => setEntries((prev) => [entry, ...prev]), tone: "danger" });
  };
  const addProject = () => {
    const name = projectDraft.trim();
    if (!name) return;
    setProjects((prev) => [{ id: `p${Date.now().toString(36)}`, name, status: "active", next: "", createdAt: today() }, ...(Array.isArray(prev) ? prev : [])]);
    setProjectDraft("");
    toast("Project added 🚀", { tone: "success", duration: 2200 });
  };
  const patchProject = (id, patch) =>
    setProjects((prev) => (Array.isArray(prev) ? prev : []).map((p) => (p?.id === id ? { ...p, ...patch } : p)));
  const deleteProject = (p) => {
    setProjects((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x?.id !== p.id));
    toast(`"${p.name}" deleted`, { action: "Undo", onAction: () => setProjects((prev2) => [p, ...(Array.isArray(prev2) ? prev2 : [])]), tone: "danger" });
  };

  // ── Shared habit row (Today + quick contexts) ──────────────────────
  const HabitRow = ({ h }) => {
    const v = valueOn(h, ds), done = isDone(h, ds), skipped = isSkipped(h, ds) && !done;
    const target = h.target || 1, multi = target > 1;
    const streak = currentStreak(h);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: done ? `${h.color}0C` : GL, borderRadius: 11, border: `1px solid ${done ? h.color + "44" : BD}`, opacity: skipped ? 0.55 : 1 }}>
        <button onClick={() => tap(h)} title={done ? "Undo" : multi ? `+1 (${v}/${target})` : "Complete"}
          style={{ width: 34, height: 34, borderRadius: 9, background: done ? `${h.color}33` : GL, border: `2px solid ${done ? h.color : BD2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, cursor: "pointer", flexShrink: 0 }}>
          {done ? <Check size={15} color={h.color} /> : h.icon}
        </button>
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => tap(h)}>
          <div style={{ fontSize: 13, color: done ? T1 : T2, fontWeight: done ? 600 : 500, textDecoration: skipped ? "line-through" : "none" }}>{h.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            {streak > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: AM }}><Flame size={9} />{streak}d</span>}
            {skipped && <span style={{ fontSize: 10, color: T3 }}>skipped — streak safe</span>}
            {multi && !skipped && (
              <div style={{ flex: 1, maxWidth: 130, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: BD, borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (v / target) * 100)}%`, background: h.color, borderRadius: 2, transition: "width 0.3s" }} />
                </div>
                <span style={{ fontSize: 10, color: T3, fontFamily: "monospace", whiteSpace: "nowrap" }}>{v}/{target}{h.unit ? ` ${h.unit}` : ""}</span>
              </div>
            )}
          </div>
        </div>
        {!done && !skipped && (
          <button onClick={() => skip(h)} title="Skip today (streak safe)" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 4 }}><SkipForward size={13} /></button>
        )}
        {skipped && (
          <button onClick={() => skip(h)} title="Unskip" style={{ background: "none", border: "none", color: AM, cursor: "pointer", display: "flex", padding: 4 }}><Play size={13} /></button>
        )}
      </div>
    );
  };

  const TABS = [
    { id: "today",    l: "Today",    i: Sun },
    { id: "habits",   l: "Habits",   i: ListChecks },
    { id: "routines", l: "Routines", i: Layers },
    { id: "insights", l: "Insights", i: TrendingUp },
    { id: "journal",  l: "Journal",  i: BookOpen },
    { id: "projects", l: "Projects", i: FolderKanban },
    { id: "purity",   l: "Purity",   i: ShieldCheck },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: "rgba(9,13,24,0.5)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: `1px solid ${BD}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 3, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: 3 }}>
          {TABS.map(({ id, l, i: Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === id ? `linear-gradient(135deg,${GR}22,${CY}22)` : "transparent", color: tab === id ? GR : T2, fontSize: 12, fontWeight: tab === id ? 600 : 400, fontFamily: "inherit", whiteSpace: "nowrap" }}>
              <Icon size={11} />{l}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div title={`${xp - prevXp}/${nextXp - prevXp} XP to level ${level + 1}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: `${AM}11`, border: `1px solid ${AM}22`, borderRadius: 9 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: AM, letterSpacing: 0.5 }}>LVL {level}</span>
          <div style={{ width: 64, height: 4, background: BD, borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${Math.min(100, Math.round(((xp - prevXp) / Math.max(1, nextXp - prevXp)) * 100))}%`, background: `linear-gradient(90deg,${AM}88,${AM})`, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 10, color: T3, fontFamily: "monospace" }}>{xp.toLocaleString()} XP</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {!loaded && <Hydrating label="Loading your habits…" />}
        {/* ══ TODAY ══ */}
        {loaded && tab === "today" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
            <Card style={{ padding: "20px 22px", background: `linear-gradient(180deg,${GR}08,transparent)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
                <Ring pct={pctToday} color={pctToday === 100 ? GR : CY}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: pctToday === 100 ? GR : T1, fontFamily: "'JetBrains Mono',monospace" }}>{pctToday}%</div>
                  <div style={{ fontSize: 8.5, color: T3, letterSpacing: 1.5 }}>TODAY</div>
                </Ring>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: T1, marginBottom: 4 }}>
                    {pctToday === 100 && scheduledToday.length > 0 ? "Perfect day. ⭐" : `${scheduledToday.length - doneToday.length - skippedToday.length} habit${scheduledToday.length - doneToday.length - skippedToday.length === 1 ? "" : "s"} to go`}
                  </div>
                  <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.55, marginBottom: 10 }}>
                    {pctToday === 100 && scheduledToday.length > 0
                      ? "Every habit tended. Rest easy — this is exactly how it compounds."
                      : "One tap each. The smallest version still counts."}
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, color: GR }}>✓ {doneToday.length} done</span>
                    {skippedToday.length > 0 && <span style={{ fontSize: 11.5, color: T3 }}>↷ {skippedToday.length} skipped</span>}
                    <span style={{ fontSize: 11.5, color: AM, display: "flex", alignItems: "center", gap: 4 }}><Flame size={11} />{Math.max(0, ...active.map(currentStreak))}d best streak</span>
                    <span style={{ fontSize: 11.5, color: PU, display: "flex", alignItems: "center", gap: 4 }}><Star size={11} />{perfectDays(habits, 90).length} perfect days (90d)</span>
                  </div>
                </div>
              </div>
            </Card>

            {routines.length > 0 && (
              <Collapse id="life_routines" title="Routines" count={routines.length}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                {routines.map((r) => {
                  const p = routineProgress(habits, r);
                  return (
                    <Card key={r.id} style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{r.icon} {r.name}</span>
                        <span style={{ fontSize: 11, color: p.pct === 100 ? GR : T3, fontFamily: "monospace" }}>{p.done}/{p.total}</span>
                      </div>
                      <div style={{ height: 5, background: BD, borderRadius: 3, marginBottom: 10 }}>
                        <div style={{ height: "100%", width: `${p.pct}%`, background: p.pct === 100 ? GR : `linear-gradient(90deg,${CY}77,${CY})`, borderRadius: 3, transition: "width 0.4s" }} />
                      </div>
                      {p.pct === 100
                        ? <div style={{ fontSize: 11.5, color: GR, fontWeight: 700 }}>✓ Routine complete</div>
                        : <button onClick={() => runRoutine(r)} style={{ width: "100%", padding: "7px", background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 8, color: GR, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Complete all →</button>}
                    </Card>
                  );
                })}
              </div>
              </Collapse>
            )}

            {nonNegHabits.length > 0 && <NonNegotiables habits={nonNegHabits} onTap={tapId} />}
            {wellnessHabits.length > 0 && <WellnessPanel habits={wellnessHabits} onSetValue={setValue} />}

            {weeklyHabits.length > 0 && (
              <Collapse id="life_weekly" title="Weekly" sub="resets Sunday"
                right={<span style={{ fontSize: 10.5, color: T3 }}>{weeklyHabits.filter((h) => weekProgress(h).met).length}/{weeklyHabits.length} met</span>}>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
                  {weeklyHabits.map((h) => {
                    const wp = weekProgress(h);
                    const doneToday = isDone(h, ds);
                    const wstreak = weeklyStreak(h);
                    return (
                      <Card key={h.id} style={{ padding: "13px 15px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                          <button onClick={() => tapId(h.id)} title={doneToday ? "Logged today — tap to undo" : "Log for today"} style={{ width: 32, height: 32, borderRadius: 9, background: doneToday ? `${h.color}33` : GL, border: `2px solid ${doneToday ? h.color : BD2}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer", flexShrink: 0 }}>
                            {doneToday ? <Check size={14} color={h.color} /> : h.icon}
                          </button>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12.5, color: T1, fontWeight: 600 }}>{h.name}</div>
                            <div style={{ fontSize: 10, color: T3 }}>{h.category}{wstreak > 0 ? ` · 🔥 ${wstreak}w` : ""}</div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: wp.met ? GR : h.color, fontFamily: "monospace" }}>{wp.done}/{wp.target}</span>
                        </div>
                        <div style={{ height: 5, background: BD, borderRadius: 3 }}>
                          <div style={{ height: "100%", width: `${wp.pct}%`, background: wp.met ? GR : `linear-gradient(90deg,${h.color}77,${h.color})`, borderRadius: 3, transition: "width 0.4s" }} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
              </Collapse>
            )}

            {scheduledToday.length === 0 ? (
              <Card style={{ padding: "38px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🌱</div>
                <div style={{ fontSize: 14, color: T2, marginBottom: 6 }}>{active.length ? "Nothing scheduled today — rest is part of the system." : "No habits yet"}</div>
                {!active.length && <button onClick={() => { setTab("habits"); setEditing(newHabit()); }} style={{ marginTop: 8, padding: "9px 18px", background: `linear-gradient(135deg,${GR},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Create your first habit</button>}
              </Card>
            ) : (
              <Collapse id="life_daily" title="Daily Habits" count={catHabitsToday.length}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {categories.map((cat) => {
                const catHabits = catHabitsToday.filter((h) => h.category === cat);
                if (!catHabits.length) return null;
                const catDone = catHabits.filter((h) => isDone(h, ds)).length;
                return (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: T3, letterSpacing: 2, textTransform: "uppercase" }}>{cat}</span>
                      <span style={{ fontSize: 10.5, color: catDone === catHabits.length ? GR : T3, fontFamily: "monospace" }}>{catDone}/{catHabits.length}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {catHabits.map((h) => <HabitRow key={h.id} h={h} />)}
                    </div>
                  </div>
                );
              })}
              </div>
              </Collapse>
            )}
          </div>
        )}

        {/* ══ HABITS (manage) ══ */}
        {loaded && tab === "habits" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Habits</div>
                <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>{active.length} active · {habits.filter((h) => h.archived).length} archived</div>
              </div>
              {!editing && <button onClick={() => setEditing(newHabit())} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: `linear-gradient(135deg,${GR},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} />New Habit</button>}
            </div>

            {editing && <HabitEditor habit={editing} categories={categories} onSave={saveHabit} onCancel={() => setEditing(null)} />}

            {!editing && (nonNegHabits.length === 0 || wellnessHabits.length === 0) && (
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                {nonNegHabits.length === 0 && (
                  <button onClick={() => addStarterPack("nonneg")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: `${RE}12`, border: `1px dashed ${RE}44`, borderRadius: 10, color: RE, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Plus size={13} />Add Non-Negotiables pack</button>
                )}
                {wellnessHabits.length === 0 && (
                  <button onClick={() => addStarterPack("wellness")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: `${CY}12`, border: `1px dashed ${CY}44`, borderRadius: 10, color: CY, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Plus size={13} />Add Wellness trackers</button>
                )}
              </div>
            )}

            {[...active, ...habits.filter((h) => h.archived)].map((h) => {
              const s30 = rangeStats(h, 30);
              return (
                <Card key={h.id} style={{ padding: "14px 16px", opacity: h.archived ? 0.55 : h.paused ? 0.75 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${h.color}18`, border: `1px solid ${h.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{h.icon}</div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T1, display: "flex", alignItems: "center", gap: 7 }}>
                        {h.name}
                        {h.paused && <span style={{ fontSize: 9, color: AM, padding: "1px 6px", borderRadius: 7, background: `${AM}18`, border: `1px solid ${AM}44` }}>PAUSED</span>}
                        {h.archived && <span style={{ fontSize: 9, color: T3, padding: "1px 6px", borderRadius: 7, background: GL, border: `1px solid ${BD}` }}>ARCHIVED</span>}
                      </div>
                      <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>
                        {h.category} · {h.days.length === 7 ? "daily" : `${h.days.length}×/week`}{h.target > 1 ? ` · ${h.target}${h.unit ? ` ${h.unit}` : "×"}/day` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 800, color: AM, fontFamily: "monospace" }}>{currentStreak(h)}</div><div style={{ fontSize: 8.5, color: T3, letterSpacing: 1 }}>STREAK</div></div>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 800, color: PU, fontFamily: "monospace" }}>{longestStreak(h)}</div><div style={{ fontSize: 8.5, color: T3, letterSpacing: 1 }}>BEST</div></div>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 800, color: s30.pct >= 70 ? GR : s30.pct >= 40 ? CY : RE, fontFamily: "monospace" }}>{s30.pct}%</div><div style={{ fontSize: 8.5, color: T3, letterSpacing: 1 }}>30 DAYS</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setEditing({ ...h })} title="Edit" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: T2, display: "flex" }}><Pencil size={12} /></button>
                      <button onClick={() => duplicateHabit(h)} title="Duplicate" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: CY, display: "flex" }}><Copy size={12} /></button>
                      <button onClick={() => patchHabit(h.id, { paused: !h.paused })} title={h.paused ? "Resume" : "Pause (streak safe)"} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: h.paused ? GR : AM, display: "flex" }}>{h.paused ? <Play size={12} /> : <Pause size={12} />}</button>
                      <button onClick={() => patchHabit(h.id, { archived: !h.archived })} title={h.archived ? "Restore" : "Archive"} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: h.archived ? GR : T3, display: "flex" }}>{h.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}</button>
                      <button onClick={() => deleteHabit(h)} title="Delete" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ══ ROUTINES ══ */}
        {loaded && tab === "routines" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Routines</div>
                <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>Group habits — one tap completes them all</div>
              </div>
              {!routineDraft && <button onClick={() => setRoutineDraft(newRoutine())} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: `linear-gradient(135deg,${GR},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} />New Routine</button>}
            </div>

            {routineDraft && (
              <Card style={{ padding: "18px", borderColor: CY + "44" }}>
                <div style={{ display: "flex", gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
                  {["🌅", "🌙", "🏋️", "📊", "🧘", "📚", "💼"].map((ic) => (
                    <button key={ic} onClick={() => setRoutineDraft((r) => ({ ...r, icon: ic }))} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer", background: routineDraft.icon === ic ? `${CY}22` : GL, border: `1px solid ${routineDraft.icon === ic ? CY + "66" : BD}` }}>{ic}</button>
                  ))}
                  <input autoFocus value={routineDraft.name} onChange={(e) => setRoutineDraft((r) => ({ ...r, name: e.target.value }))} placeholder="Routine name (e.g. Morning Routine)"
                    style={{ flex: 1, minWidth: 160, background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit" }} />
                </div>
                <div style={{ fontSize: 10, color: T3, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 7 }}>Habits in this routine · {routineDraft.habitIds.length} selected</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 7, marginBottom: 14 }}>
                  {active.map((h) => {
                    const on = routineDraft.habitIds.includes(h.id);
                    return (
                      <button key={h.id} onClick={() => setRoutineDraft((r) => ({ ...r, habitIds: on ? r.habitIds.filter((x) => x !== h.id) : [...r.habitIds, h.id] }))}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, cursor: "pointer", textAlign: "left", background: on ? `${h.color}14` : GL, border: `1px solid ${on ? h.color + "55" : BD}`, color: on ? T1 : T2, fontSize: 12, fontFamily: "inherit" }}>
                        <span>{h.icon}</span><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                        {on && <Check size={12} color={h.color} />}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
                  <button onClick={() => setRoutineDraft(null)} style={{ padding: "8px 15px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={saveRoutine} disabled={!routineDraft.name.trim() || !routineDraft.habitIds.length}
                    style={{ padding: "8px 18px", background: routineDraft.name.trim() && routineDraft.habitIds.length ? `linear-gradient(135deg,${GR},${CY})` : GL, border: "none", borderRadius: 9, color: routineDraft.name.trim() && routineDraft.habitIds.length ? "#000" : T3, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save Routine</button>
                </div>
              </Card>
            )}

            {routines.length === 0 && !routineDraft && (
              <Card style={{ padding: "38px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>🌅</div>
                <div style={{ fontSize: 14, color: T2, marginBottom: 4 }}>No routines yet</div>
                <div style={{ fontSize: 12, color: T3 }}>Bundle your morning, gym or night habits so one tap completes the whole block.</div>
              </Card>
            )}

            {routines.map((r) => {
              const p = routineProgress(habits, r);
              const members = active.filter((h) => r.habitIds.includes(h.id));
              return (
                <Card key={r.id} style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 20 }}>{r.icon}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: T1, flex: 1 }}>{r.name}</span>
                    <span style={{ fontSize: 11.5, color: p.pct === 100 ? GR : T3, fontFamily: "monospace" }}>{p.done}/{p.total} today</span>
                    <button onClick={() => setRoutineDraft({ ...r })} title="Edit" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: T2, display: "flex" }}><Pencil size={12} /></button>
                    <button onClick={() => deleteRoutine(r)} title="Delete" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={12} /></button>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {members.map((h) => (
                      <span key={h.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, padding: "4px 10px", borderRadius: 14, background: isDone(h, ds) ? `${h.color}18` : GL, color: isDone(h, ds) ? h.color : T3, border: `1px solid ${isDone(h, ds) ? h.color + "44" : BD}` }}>
                        {isDone(h, ds) ? <Check size={10} /> : null}{h.icon} {h.name}
                      </span>
                    ))}
                  </div>
                  {p.pct < 100 && (
                    <button onClick={() => runRoutine(r)} style={{ padding: "8px 16px", background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 9, color: GR, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Complete all {p.total} habits →</button>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ══ INSIGHTS ══ */}
        {loaded && tab === "insights" && (() => {
          const totalDone = habits.reduce((s, h) => s + totalCompletions(h), 0);
          const bestStreakAll = Math.max(0, ...habits.map(longestStreak));
          const perfect = perfectDays(habits);
          const ranked = active.map((h) => ({ h, s: rangeStats(h, 30) })).filter((x) => x.s.scheduled > 0).sort((a, b) => b.s.pct - a.s.pct);
          const weeks = Array.from({ length: 8 }, (_, i) => {
        const stats = active.map((h) => {
              let sched = 0, done = 0;
              for (let dOff = i * 7; dOff < i * 7 + 7; dOff++) {
                const dd = daysAgoStr(dOff);
                if (isScheduled(h, dd)) { sched++; if (isDone(h, dd)) done++; }
              }
              return { sched, done };
            });
            const sched = stats.reduce((s, x) => s + x.sched, 0), done = stats.reduce((s, x) => s + x.done, 0);
            return { label: i === 0 ? "This wk" : `-${i}w`, pct: sched ? Math.round((done / sched) * 100) : 0 };
          }).reverse();
          const catPerf = categories.map((cat) => {
            const hs = active.filter((h) => h.category === cat);
            const agg = hs.reduce((a, h) => { const s = rangeStats(h, 30); return { sched: a.sched + s.scheduled, done: a.done + s.done }; }, { sched: 0, done: 0 });
            return { cat, pct: agg.sched ? Math.round((agg.done / agg.sched) * 100) : 0, n: hs.length };
          }).filter((c) => c.n > 0).sort((a, b) => b.pct - a.pct);
          const sel = active.find((h) => h.id === insightHabit) || active[0];
          const wk = active.reduce((a, h) => { const s = rangeStats(h, 7); return { sched: a.sched + s.scheduled, done: a.done + s.done, skip: a.skip + s.skipped }; }, { sched: 0, done: 0, skip: 0 });
          const mo = active.reduce((a, h) => { const s = rangeStats(h, 30); return { sched: a.sched + s.scheduled, done: a.done + s.done }; }, { sched: 0, done: 0 });
          const perfectThisMonth = perfect.filter((d) => d >= daysAgoStr(30)).length;

          return (
            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 11 }}>
                <Chip label="Total Completions" value={totalDone.toLocaleString()} color={GR} />
                <Chip label="Longest Streak"    value={`${bestStreakAll}d`} color={AM} />
                <Chip label="Perfect Days"      value={perfect.length} color={PU} />
                <Chip label="Level"             value={`${level} · ${xp.toLocaleString()} XP`} color={CY} />
              </div>

              <Card style={{ padding: "18px" }}>
                <SH title="Weekly Review" sub="Last 7 days vs the month" action={<Trophy size={13} color={AM} />} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 4 }}>
                  <div><div style={{ fontSize: 22, fontWeight: 900, color: wk.sched && wk.done / wk.sched >= 0.7 ? GR : AM, fontFamily: "monospace" }}>{wk.sched ? Math.round((wk.done / wk.sched) * 100) : 0}%</div><div style={{ fontSize: 10.5, color: T3 }}>this week · {wk.done}/{wk.sched} done{wk.skip ? ` · ${wk.skip} skipped` : ""}</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 900, color: CY, fontFamily: "monospace" }}>{mo.sched ? Math.round((mo.done / mo.sched) * 100) : 0}%</div><div style={{ fontSize: 10.5, color: T3 }}>last 30 days · {perfectThisMonth} perfect days</div></div>
                  {catPerf.length > 0 && <div><div style={{ fontSize: 15, fontWeight: 800, color: GR }}>{catPerf[0].cat}</div><div style={{ fontSize: 10.5, color: T3 }}>strongest category · {catPerf[0].pct}%</div></div>}
                  {catPerf.length > 1 && <div><div style={{ fontSize: 15, fontWeight: 800, color: RE }}>{catPerf[catPerf.length - 1].cat}</div><div style={{ fontSize: 10.5, color: T3 }}>needs love · {catPerf[catPerf.length - 1].pct}%</div></div>}
                </div>
              </Card>

              {weeks.some((w) => w.pct > 0) && (
                <Card style={{ padding: "18px" }}>
                  <SH title="Consistency Trend" sub="Completion rate per week — direction matters more than the number" />
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={weeks} margin={{ top: 0, right: 0, bottom: 0, left: -22 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                      <XAxis dataKey="label" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={mkTT("", "%")} />
                      <Bar dataKey="pct" radius={[5, 5, 0, 0]} fill={GR} fillOpacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {sel && (
                <Card style={{ padding: "18px" }}>
                  <SH title="Habit Calendar" sub="13 weeks of history — every square is a day" />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {active.map((h) => (
                      <button key={h.id} onClick={() => setInsightHabit(h.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 14, fontSize: 11.5, cursor: "pointer", background: sel.id === h.id ? `${h.color}18` : GL, color: sel.id === h.id ? h.color : T2, border: `1px solid ${sel.id === h.id ? h.color + "55" : BD}`, fontFamily: "inherit" }}>{h.icon} {h.name}</button>
                    ))}
                  </div>
                  <ActivityHeatmap counts={Object.fromEntries(Object.entries(sel.log || {}).filter(([, e]) => (e?.v || 0) >= (sel.target || 1)).map(([d]) => [d, 1]))} weeks={13} color={sel.color} />
                  <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: T3 }}>
                    <span>🔥 {currentStreak(sel)}d current</span>
                    <span>🏆 {longestStreak(sel)}d best</span>
                    <span>✓ {totalCompletions(sel)} total</span>
                    <span>{rangeStats(sel, 30).pct}% last 30d</span>
                  </div>
                </Card>
              )}

              {ranked.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
                  <Card style={{ padding: "18px" }}>
                    <SH title="Best Performing" sub="Highest 30-day completion" />
                    {ranked.slice(0, 4).map(({ h, s }) => (
                      <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: `1px solid ${BD}` }}>
                        <span>{h.icon}</span><span style={{ flex: 1, fontSize: 12.5, color: T1 }}>{h.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: GR, fontFamily: "monospace" }}>{s.pct}%</span>
                      </div>
                    ))}
                  </Card>
                  <Card style={{ padding: "18px" }}>
                    <SH title="Needs Attention" sub="Most missed — shrink these, don't force them" />
                    {[...ranked].reverse().slice(0, 4).map(({ h, s }) => (
                      <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: `1px solid ${BD}` }}>
                        <span>{h.icon}</span><span style={{ flex: 1, fontSize: 12.5, color: T1 }}>{h.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: s.pct >= 50 ? AM : RE, fontFamily: "monospace" }}>{s.pct}%</span>
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {catPerf.length > 0 && (
                <Card style={{ padding: "18px" }}>
                  <SH title="Category Performance" sub="30-day completion by life area" />
                  {catPerf.map((c) => (
                    <div key={c.cat} style={{ marginBottom: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: T2 }}>{c.cat} <span style={{ color: T3, fontSize: 10.5 }}>· {c.n} habit{c.n > 1 ? "s" : ""}</span></span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.pct >= 70 ? GR : c.pct >= 40 ? CY : RE, fontFamily: "monospace" }}>{c.pct}%</span>
                      </div>
                      <div style={{ height: 5, background: BD, borderRadius: 3 }}>
                        <div style={{ height: "100%", width: `${c.pct}%`, background: c.pct >= 70 ? GR : c.pct >= 40 ? CY : RE, borderRadius: 3 }} />
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              <Card style={{ padding: "18px" }}>
                <SH title="Achievements" sub="Earned through real consistency — never bought" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
                  {badgeList.map((b) => (
                    <div key={b.name} style={{ padding: "12px 10px", textAlign: "center", background: b.got ? `${AM}0D` : GL, border: `1px solid ${b.got ? AM + "44" : BD}`, borderRadius: 11, opacity: b.got ? 1 : 0.45 }}>
                      <div style={{ fontSize: 20, marginBottom: 5, filter: b.got ? "none" : "grayscale(1)" }}>{b.icon}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: b.got ? AM : T3 }}>{b.name}</div>
                      <div style={{ fontSize: 9.5, color: T3, marginTop: 2 }}>{b.desc}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          );
        })()}

        {/* ══ JOURNAL ══ */}
        {loaded && tab === "journal" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
            <Card style={{ padding: "20px" }}>
              <SH title="Daily Reflection" sub={new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
              <div style={{ fontSize: 11.5, color: T3, marginBottom: 10, lineHeight: 1.6 }}>Reflect to learn, not to judge. Tap a prompt to begin.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 11 }}>
                {REFLECTION_PROMPTS.map((p) => (
                  <button key={p} onClick={() => setJournal((j) => (j ? `${j}\n\n${p}\n` : `${p}\n`))}
                    style={{ padding: "5px 11px", borderRadius: 20, border: `1px solid ${CY}33`, background: `${CY}12`, color: CY, fontSize: 11, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4, textAlign: "left" }}>
                    {p}
                  </button>
                ))}
              </div>
              <textarea value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="One honest sentence is enough. What improved today?"
                style={{ width: "100%", minHeight: 110, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px", fontSize: 13, color: T1, lineHeight: 1.7, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              <button onClick={saveEntry} style={{ marginTop: 9, width: "100%", padding: "9px", background: `linear-gradient(135deg,${CY}22,${PU}22)`, border: `1px solid ${CY}44`, borderRadius: 10, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Save Entry
              </button>
            </Card>
            {entries.map((e) => (
              <div key={e.id} style={{ padding: "12px 14px", background: GL, borderRadius: 11, border: `1px solid ${BD}`, display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>{new Date(e.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                  <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{e.text}</div>
                </div>
                <button onClick={() => deleteEntry(e.id)} title="Delete entry" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", alignSelf: "flex-start", padding: 2 }}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}

        {/* ══ PROJECTS ══ */}
        {loaded && tab === "projects" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Personal Projects</div>
              <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>Each project only ever needs one thing: its next step.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={projectDraft} onChange={(e) => setProjectDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProject()}
                placeholder="New project name…"
                style={{ flex: 1, background: B2, border: `1px solid ${BD}`, borderRadius: 10, padding: "10px 13px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit" }} />
              <button onClick={addProject} disabled={!projectDraft.trim()} aria-label="Add project"
                style={{ padding: "0 16px", borderRadius: 10, border: "none", background: projectDraft.trim() ? `linear-gradient(135deg,${GR},${CY})` : GL, color: projectDraft.trim() ? "#000" : T3, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                <Plus size={14} />Add
              </button>
            </div>
            {projects.length === 0 && (
              <Card style={{ padding: "34px", textAlign: "center" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>🚀</div>
                <div style={{ fontSize: 13, color: T2 }}>No projects yet. The side hustle, the room makeover, the certification — name it and define its next step.</div>
              </Card>
            )}
            {[...projects].sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0)).map((p) => (
              <Card key={p.id} style={{ padding: "14px 16px", opacity: p.status === "done" ? 0.7 : p.status === "paused" ? 0.85 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 9 }}>
                  <span style={{ fontSize: 14 }}>{p.status === "done" ? "✅" : p.status === "paused" ? "⏸️" : "🚀"}</span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T1, minWidth: 140, textDecoration: p.status === "done" ? "line-through" : "none" }}>{p.name}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["active", "paused", "done"].map((s) => (
                      <button key={s} onClick={() => patchProject(p.id, { status: s })}
                        style={{ padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${p.status === s ? (s === "done" ? GR : s === "paused" ? AM : CY) + "55" : BD}`, background: p.status === s ? `${s === "done" ? GR : s === "paused" ? AM : CY}18` : GL, color: p.status === s ? (s === "done" ? GR : s === "paused" ? AM : CY) : T3 }}>
                        {s}
                      </button>
                    ))}
                    <button onClick={() => deleteProject(p)} aria-label={`Delete ${p.name}`} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "4px 7px", cursor: "pointer", color: RE, display: "flex", alignItems: "center" }}><Trash2 size={11} /></button>
                  </div>
                </div>
                {p.status !== "done" && (
                  <input value={p.next || ""} onChange={(e) => patchProject(p.id, { next: e.target.value })}
                    placeholder="Next step — small enough to do this week"
                    aria-label={`Next step for ${p.name}`}
                    style={{ width: "100%", background: GL, border: `1px dashed ${BD2}`, borderRadius: 9, padding: "8px 11px", fontSize: 12, color: T2, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                )}
              </Card>
            ))}
          </div>
        )}

        {/* ══ PURITY ══ */}
        {loaded && tab === "purity" && <PurityTab />}
      </div>
    </div>
  );
}
