import { useMemo, useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  Sun, ListChecks, Layers, TrendingUp, BookOpen, Plus, Check, Flame, SkipForward,
  Pencil, Copy, Archive, ArchiveRestore, Trash2, Pause, Play, Star, Trophy, ShieldCheck,
} from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, CY, PU, GR, RE, AM, AC } from "../../shared/designTokens.js";
import { Card, SH, Chip, Hydrating, Meter, Empty } from "../../shared/ui.jsx";
import { DatePicker, relativeDateLabel } from "../../shared/DatePicker.jsx";
import { MotivePush } from "../../shared/MotivePush.jsx";
import { Collapse } from "../../shared/Collapse.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { ActivityHeatmap, Ring } from "../../shared/charts.jsx";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { REFLECTION_PROMPTS } from "../../shared/kaizen.js";
import {
  newHabit, newRoutine, isScheduled, isDone, isSkipped, valueOn, tapHabit, toggleSkip, setHabitValue,
  currentStreak, longestStreak, rangeStats, totalCompletions, perfectDays,
  xpOf, levelOf, xpForLevel, badges, completeRoutine, routineProgress,
  isWeekly, weekProgress, weeklyStreak, isWellness, isNonNeg, isOnePct, makeNonNeg, makeWellness, makeOnePct,
} from "../../shared/habitEngine.js";
import { HabitEditor } from "./HabitEditor.jsx";
import { HabitListCard } from "./HabitListCard.jsx";
import { HabitDetail } from "./HabitDetail.jsx";
import { TierPanel } from "./TierPanel.jsx";
import { PurityTab } from "./PurityTab.jsx";
import { Journals } from "./Journals.jsx";
import { ModeHistoryStrip } from "../../shared/ModeHistoryStrip.jsx";
import { useFocusRequest } from "../../shared/searchFocus.js";

const today = () => localDateStr();

export function LifeOSCore({ habits, setHabits, loaded = true, onNavigate, xpInfo }) {
  const [tab, setTab] = useState("today");
  // A palette result deep-links here — land on the record's own inner tab.
  const focus = useFocusRequest();
  useEffect(() => { if (focus?.module === "life" && focus.tab) setTab(focus.tab); }, [focus?.nonce]); // eslint-disable-line
  const [editing, setEditing] = useState(null);         // habit being edited or newHabit()
  const [rawRoutines, setRoutines] = useStorageState("routines", []);
  const [routineDraft, setRoutineDraft] = useState(null);
  const [insightHabit, setInsightHabit] = useState(null);
  const [detailId, setDetailId] = useState(null); // Screen 1 → Screen 2 drill-down
  const [journal, setJournal] = useState("");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalDs, setJournalDs] = useState(() => today());
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [rawEntries, setEntries] = useStorageState("journal_entries", []);
  const toast = useToast();

  // Stored records can be corrupt (null entries, habitIds missing) — sanitise
  // once at the read point so every render below can trust the shape.
  const routines = useMemo(
    () => (Array.isArray(rawRoutines) ? rawRoutines : [])
      .filter((r) => r && typeof r === "object" && r.id)
      .map((r) => (Array.isArray(r.habitIds) ? r : { ...r, habitIds: [] })),
    [rawRoutines]
  );
  // Sorted newest-first by the day the entry is *about* — backdated entries
  // slot into their true chronological place instead of the top of the list.
  const entries = useMemo(
    () => (Array.isArray(rawEntries) ? rawEntries : [])
      .filter((e) => e && typeof e === "object" && e.id)
      .slice()
      .sort((a, b) => ((b.date || "").slice(0, 10)).localeCompare((a.date || "").slice(0, 10))),
    [rawEntries]
  );
  const active = habits.filter((h) => !h.archived);
  const ds = today();
  // The Today tab is backdatable — `viewDs` is the day being viewed/logged
  // (defaults to today, moved via the DatePicker), distinct from `ds` (always
  // the real today), which the Routines/Insights tabs still use as-is.
  const [viewDs, setViewDs] = useState(() => today());

  // Pillar groupings — surfaced in dedicated graphed sections, not the list.
  const wellnessHabits = active.filter((h) => isWellness(h) && !isWeekly(h));
  const nonNegHabits = active.filter((h) => isNonNeg(h) && !isWeekly(h));
  const onePctHabits = active.filter((h) => isOnePct(h) && !isWeekly(h));
  const weeklyHabits = active.filter(isWeekly);

  // Today's schedule (all daily habits feed the ring; pillars render separately)
  const scheduledToday = active.filter((h) => isScheduled(h, viewDs));
  const catHabitsToday = scheduledToday.filter((h) => !isWellness(h) && !isNonNeg(h) && !isOnePct(h));
  const categories = [...new Set(catHabitsToday.map((h) => h.category))];
  const doneToday = scheduledToday.filter((h) => isDone(h, viewDs));
  const skippedToday = scheduledToday.filter((h) => isSkipped(h, viewDs) && !isDone(h, viewDs));
  const pctToday = scheduledToday.length ? Math.round((doneToday.length / scheduledToday.length) * 100) : 0;
  // Global progression from App — the level here always matches the header.
  const xp = xpInfo ? xpInfo.total : xpOf(habits);
  const level = xpInfo ? xpInfo.level : levelOf(xp);
  const nextXp = xpInfo ? xpInfo.nextLevelXp : xpForLevel(level + 1);
  const prevXp = xpInfo ? xpInfo.prevLevelXp : xpForLevel(level);
  const badgeList = useMemo(() => badges(habits, level), [habits, level]);

  // ── Actions ────────────────────────────────────────────────────────
  const tap = (h) => {
    const wasPerfect = scheduledToday.length && scheduledToday.every((x) => isDone(x, viewDs));
    setHabits((prev) => tapHabit(prev, h.id, viewDs));
    if (!isDone(h, viewDs)) {
      const willBeDone = valueOn(h, viewDs) + 1 >= (h.target || 1);
      const remaining = scheduledToday.filter((x) => x.id !== h.id && !isDone(x, viewDs) && !isSkipped(x, viewDs)).length;
      if (willBeDone && remaining === 0 && !wasPerfect && scheduledToday.length > 1) {
        toast("⭐ Perfect day — every habit complete. This is how it compounds.", { tone: "success", duration: 6000 });
      }
    }
  };
  const skip = (h) => setHabits((prev) => toggleSkip(prev, h.id, viewDs));
  const setValue = (id, v) => setHabits((prev) => setHabitValue(prev, id, v, viewDs));
  const tapId = (id) => setHabits((prev) => tapHabit(prev, id, viewDs));
  // Screen-1 (Habit List) cell mutations — date-explicit, so a given day's
  // cell edits exactly that day rather than always "today".
  const cellToggle = (id, ds) => setHabits((prev) => tapHabit(prev, id, ds));
  const cellSet = (id, ds, v) => setHabits((prev) => setHabitValue(prev, id, v, ds));
  const cellSkip = (id, ds) => setHabits((prev) => toggleSkip(prev, id, ds));
  const cellClear = (id, ds) => setHabits((prev) => setHabitValue(prev, id, 0, ds));
  const listCard = (h) => (
    <HabitListCard key={h.id} habit={h} onOpenDetail={(hh) => setDetailId(hh.id)}
      onToggle={cellToggle} onSetValue={cellSet} onSkip={cellSkip} onClear={cellClear} />
  );
  const PACKS = {
    nonneg: { is: isNonNeg, make: makeNonNeg, label: "Non-Negotiables" },
    wellness: { is: isWellness, make: makeWellness, label: "Wellness trackers" },
    onepct: { is: isOnePct, make: makeOnePct, label: "The 1%" },
  };
  const addStarterPack = (kind) => {
    const p = PACKS[kind]; if (!p) return;
    if (habits.some((h) => p.is(h) && !h.archived)) { toast(`${p.label} already set up`, { tone: "info" }); return; }
    setHabits((prev) => [...prev, ...p.make()]);
    toast(`${p.label} added`, { tone: "success" });
  };
  const saveHabit = (h) => {
    const isEdit = habits.some((x) => x.id === h.id);
    setHabits((prev) => (isEdit ? prev.map((x) => (x.id === h.id ? { ...x, ...h, editedAt: new Date().toISOString() } : x)) : [...prev, h]));
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
    const title = journalTitle.trim();
    if (editingEntryId) {
      setEntries((prev) => (Array.isArray(prev) ? prev : []).map((e) =>
        e?.id === editingEntryId ? { ...e, date: journalDs, title, text: journal, editedAt: new Date().toISOString() } : e));
      toast("Reflection updated ✍️", { tone: "success", duration: 2500 });
    } else {
      setEntries((prev) => [{ id: `j${Date.now()}`, date: journalDs, title, text: journal }, ...prev]);
      toast("Reflection saved 🌱", { tone: "success", duration: 2500 });
    }
    setEditingEntryId(null);
    setJournalDs(today());
    setJournal("");
    setJournalTitle("");
  };
  const startEditEntry = (e) => {
    setEditingEntryId(e.id);
    setJournalTitle(e.title || "");
    setJournal(e.text || "");
    setJournalDs((e.date || today()).slice(0, 10));
  };
  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setJournal("");
    setJournalTitle("");
    setJournalDs(today());
  };
  const deleteEntry = (id) => {
    const entry = entries.find((e) => e.id === id);
    if (id === editingEntryId) cancelEditEntry();
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast("Entry deleted", { action: "Undo", onAction: () => setEntries((prev) => [entry, ...prev]), tone: "danger" });
  };
  // ── Shared habit row (Today + quick contexts) ──────────────────────
  const HabitRow = ({ h }) => {
    const v = valueOn(h, viewDs), done = isDone(h, viewDs), skipped = isSkipped(h, viewDs) && !done;
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
                <Meter pct={(v / target) * 100} height={4} color={h.color} style={{ flex: 1 }} />
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

  // Habit management card — reused inside routine groups and for ungrouped habits
  const habitCard = (h) => {
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
  };

  const TABS = [
    { id: "today",    l: "Today",    i: Sun },
    { id: "habits",   l: "Habits",   i: ListChecks },
    { id: "insights", l: "Insights", i: TrendingUp },
    { id: "journal",  l: "Journal",  i: BookOpen },
    { id: "purity",   l: "Purity",   i: ShieldCheck },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tabs={TABS} active={tab} onSelect={setTab} activeBg={`linear-gradient(135deg,${CY}22,${CY}18)`} activeColor={CY}>
        <div style={{ flex: 1 }} />
        <div title={`${xp - prevXp}/${nextXp - prevXp} XP to level ${level + 1}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: `${AC}11`, border: `1px solid ${AC}22`, borderRadius: 9 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: AC, letterSpacing: 0.5 }}>LVL {level}</span>
          <Meter pct={Math.round(((xp - prevXp) / Math.max(1, nextXp - prevXp)) * 100)} height={4} fill={`linear-gradient(90deg,${AC}88,${AC})`} style={{ width: 64 }} />
          <span style={{ fontSize: 10, color: T3, fontFamily: "monospace" }}>{xp.toLocaleString()} XP</span>
        </div>
      </ModuleTabs>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {!loaded && <Hydrating label="Loading your habits…" />}
        {/* ══ TODAY ══ */}
        {loaded && tab === "today" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
            <DatePicker value={viewDs} onChange={setViewDs} />
            <Card style={{ padding: "20px 22px", background: `linear-gradient(180deg,${GR}08,transparent)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
                <Ring pct={pctToday} glow color={pctToday === 100 ? GR : CY}>
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

            <MotivePush context={pctToday === 100 && scheduledToday.length > 0 ? ["streak", "logging"] : ["day-start", "logging"]}
              state={{ streak: Math.max(0, ...active.map(currentStreak)), missedYesterday: active.length > 0 && active.every((h) => !isDone(h, daysAgoStr(1)) && isScheduled(h, daysAgoStr(1))) }} accent={CY} />

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
                      <Meter pct={p.pct} fill={p.pct === 100 ? GR : `linear-gradient(90deg,${CY}77,${CY})`} style={{ marginBottom: 10 }} />
                      {p.pct === 100
                        ? <div style={{ fontSize: 11.5, color: GR, fontWeight: 700 }}>✓ Routine complete</div>
                        : <button onClick={() => runRoutine(r)} style={{ width: "100%", padding: "7px", background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 8, color: GR, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Complete all →</button>}
                    </Card>
                  );
                })}
              </div>
              </Collapse>
            )}

            {nonNegHabits.length > 0 && <TierPanel habits={nonNegHabits} title="Non-Negotiables" sub="The lines you don't cross — no exceptions" accent={RE} onTap={tapId} onSetValue={setValue} ds={viewDs} />}
            {onePctHabits.length > 0 && <TierPanel habits={onePctHabits} title="The 1%" sub="The habits only the 1% commit to" accent={AC} onTap={tapId} onSetValue={setValue} ds={viewDs} />}
            {wellnessHabits.length > 0 && <TierPanel habits={wellnessHabits} title="Wellness" sub="Sleep · hydration · recovery" accent={PU} onTap={tapId} onSetValue={setValue} ds={viewDs} />}

            {weeklyHabits.length > 0 && (
              <Collapse id="life_weekly" title="Weekly" sub="resets Sunday"
                right={<span style={{ fontSize: 10.5, color: T3 }}>{weeklyHabits.filter((h) => weekProgress(h).met).length}/{weeklyHabits.length} met</span>}>
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
                  {weeklyHabits.map((h) => {
                    const wp = weekProgress(h);
                    const doneToday = isDone(h, viewDs);
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
                        <Meter pct={wp.pct} fill={wp.met ? GR : `linear-gradient(90deg,${h.color}77,${h.color})`} />
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
                const catDone = catHabits.filter((h) => isDone(h, viewDs)).length;
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

        {/* ══ HABITS & ROUTINES (fused) ══ */}
        {loaded && tab === "habits" && (() => {
          const grouped = new Set(routines.flatMap((r) => r.habitIds));
          const otherActive = active.filter((h) => !grouped.has(h.id));
          const archivedList = habits.filter((h) => h.archived);
          const detailHabit = detailId ? habits.find((h) => h.id === detailId) : null;
          if (detailHabit) return (
            <HabitDetail habit={detailHabit} onBack={() => setDetailId(null)}
              onEdit={(h) => { setDetailId(null); setEditing({ ...h }); }}
              onDuplicate={duplicateHabit}
              onTogglePause={(h) => patchHabit(h.id, { paused: !h.paused })}
              onToggleArchive={(h) => patchHabit(h.id, { archived: !h.archived })}
              onDelete={deleteHabit} />
          );
          return (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Habits &amp; Routines</div>
                <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>{active.length} active · {routines.length} routine{routines.length !== 1 ? "s" : ""} · {archivedList.length} archived</div>
              </div>
              {!editing && !routineDraft && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setEditing(newHabit())} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: `linear-gradient(135deg,${GR},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} />New Habit</button>
                  <button onClick={() => setRoutineDraft(newRoutine())} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: GL, border: `1px solid ${CY}55`, borderRadius: 10, color: CY, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Layers size={14} />New Routine</button>
                </div>
              )}
            </div>

            {editing && <HabitEditor habit={editing} categories={categories} onSave={saveHabit} onCancel={() => setEditing(null)} />}

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

            {!editing && (nonNegHabits.length === 0 || wellnessHabits.length === 0 || onePctHabits.length === 0) && (
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                {nonNegHabits.length === 0 && (
                  <button onClick={() => addStarterPack("nonneg")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: `${RE}12`, border: `1px dashed ${RE}44`, borderRadius: 10, color: RE, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Plus size={13} />Add Non-Negotiables pack</button>
                )}
                {onePctHabits.length === 0 && (
                  <button onClick={() => addStarterPack("onepct")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: `${AC}12`, border: `1px dashed ${AC}44`, borderRadius: 10, color: AC, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Plus size={13} />Add The 1% pack</button>
                )}
                {wellnessHabits.length === 0 && (
                  <button onClick={() => addStarterPack("wellness")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: `${CY}12`, border: `1px dashed ${CY}44`, borderRadius: 10, color: CY, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Plus size={13} />Add Wellness trackers</button>
                )}
              </div>
            )}

            {/* Routine groups — each routine is a header band over its member habit cards */}
            {routines.map((r) => {
              const p = routineProgress(habits, r);
              const members = active.filter((h) => r.habitIds.includes(h.id));
              return (
                <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "11px 15px", borderRadius: 12, background: `${CY}0e`, border: `1px solid ${CY}33` }}>
                    <span style={{ fontSize: 20 }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: T1 }}>{r.name}</div>
                      <div style={{ fontSize: 10.5, color: T3, marginTop: 1 }}>{members.length} habit{members.length !== 1 ? "s" : ""} · routine</div>
                    </div>
                    <span style={{ fontSize: 11.5, color: p.pct === 100 ? GR : T3, fontFamily: "monospace" }}>{p.done}/{p.total} today</span>
                    {p.pct < 100 && p.total > 0 && (
                      <button onClick={() => runRoutine(r)} title={`Complete all ${p.total} habits`} style={{ padding: "6px 12px", background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 9, color: GR, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Complete all →</button>
                    )}
                    <button onClick={() => setRoutineDraft({ ...r })} title="Edit routine" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: T2, display: "flex" }}><Pencil size={12} /></button>
                    <button onClick={() => deleteRoutine(r)} title="Delete routine" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={12} /></button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingLeft: 14, marginLeft: 7, borderLeft: `2px solid ${CY}22` }}>
                    {members.length ? members.map(listCard) : (
                      <div style={{ fontSize: 11.5, color: T3, padding: "6px 2px" }}>No habits in this routine yet — edit it to add some.</div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Ungrouped habits */}
            {routines.length > 0 && otherActive.length > 0 && (
              <div style={{ fontSize: 11, color: T3, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>Other habits</div>
            )}
            {otherActive.map(listCard)}

            {active.length === 0 && routines.length === 0 && !editing && !routineDraft && (
              <Empty icon="🌱" title="No habits yet" sub="Add your first habit, then bundle habits into routines you can finish in one tap." />
            )}

            {/* Archived */}
            {archivedList.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: T3, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginTop: 4 }}>Archived</div>
                {archivedList.map(habitCard)}
              </>
            )}
          </div>
          );
        })()}

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

          // Weekday rhythm — completion rate by day of week over 12 weeks, so
          // the pattern behind the streak is visible (strong Mondays, faded
          // weekends). Best/worst days are flagged.
          const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const wdBuckets = Array.from({ length: 7 }, () => ({ sched: 0, done: 0 }));
          for (let dOff = 0; dOff < 84; dOff++) {
            const dd = daysAgoStr(dOff);
            const wdi = new Date(`${dd}T12:00:00`).getDay();
            for (const h of active) {
              if (isScheduled(h, dd)) { wdBuckets[wdi].sched++; if (isDone(h, dd)) wdBuckets[wdi].done++; }
            }
          }
          const weekday = wdBuckets.map((b, i) => ({ day: WD[i], pct: b.sched ? Math.round((b.done / b.sched) * 100) : 0, sched: b.sched }));
          const wdActive = weekday.filter((w) => w.sched > 0);
          const wdBest = wdActive.length ? wdActive.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;
          const wdWorst = wdActive.length ? wdActive.reduce((a, b) => (b.pct < a.pct ? b : a)) : null;

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
                    <LineChart data={weeks} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                      <XAxis dataKey="label" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={mkTT("", "%")} />
                      <Line type="monotone" dataKey="pct" stroke={GR} strokeWidth={2} dot={{ fill: GR, r: 2.5 }} />
                    </LineChart>
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
                      <Meter pct={c.pct} color={c.pct >= 70 ? GR : c.pct >= 40 ? CY : RE} />
                    </div>
                  ))}
                </Card>
              )}

              {wdActive.length > 1 && (
                <Card style={{ padding: "18px" }}>
                  <SH title="Weekday Pattern" sub="Completion rate by day — last 12 weeks" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 7, alignItems: "end", height: 120, marginTop: 6 }}>
                    {weekday.map((w) => {
                      const c = w.sched === 0 ? BD : w.pct >= 70 ? GR : w.pct >= 40 ? CY : RE;
                      return (
                        <div key={w.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 5, height: "100%" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: w.sched === 0 ? T3 : c, fontFamily: "monospace" }}>{w.sched === 0 ? "—" : `${w.pct}%`}</span>
                          <div style={{ width: "100%", height: `${Math.max(3, w.pct * 0.82)}%`, minHeight: 3, background: c, borderRadius: 4, opacity: w.sched === 0 ? 0.3 : 1 }} />
                          <span style={{ fontSize: 10, color: T3 }}>{w.day}</span>
                        </div>
                      );
                    })}
                  </div>
                  {wdBest && wdWorst && wdBest.day !== wdWorst.day && (
                    <div style={{ fontSize: 11, color: T3, marginTop: 12, lineHeight: 1.5 }}>
                      Strongest on <b style={{ color: GR }}>{wdBest.day}</b> ({wdBest.pct}%) · softest on <b style={{ color: wdWorst.pct >= 50 ? AM : RE }}>{wdWorst.day}</b> ({wdWorst.pct}%). Protect the weak day with the smallest version.
                    </div>
                  )}
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
              <SH title={editingEntryId ? "Edit Reflection" : "Daily Reflection"} />
              <DatePicker value={journalDs} onChange={setJournalDs} />
              <div style={{ fontSize: 11.5, color: T3, margin: "10px 0", lineHeight: 1.6 }}>Reflect to learn, not to judge. Tap a prompt to begin.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 11 }}>
                {REFLECTION_PROMPTS.map((p) => (
                  <button key={p} onClick={() => setJournal((j) => (j ? `${j}\n\n${p}\n` : `${p}\n`))}
                    style={{ padding: "5px 11px", borderRadius: 20, border: `1px solid ${CY}33`, background: `${CY}12`, color: CY, fontSize: 11, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4, textAlign: "left" }}>
                    {p}
                  </button>
                ))}
              </div>
              <input value={journalTitle} onChange={(e) => setJournalTitle(e.target.value)} placeholder="Title (optional)"
                style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "10px 13px", fontSize: 14, fontWeight: 700, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
              <textarea value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="One honest sentence is enough. What improved today?"
                style={{ width: "100%", minHeight: 110, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px", fontSize: 13, color: T1, lineHeight: 1.7, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                <button onClick={saveEntry} style={{ flex: 1, padding: "9px", background: `linear-gradient(135deg,${CY}22,${PU}22)`, border: `1px solid ${CY}44`, borderRadius: 10, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {editingEntryId ? "Update Entry" : "Save Entry"}
                </button>
                {editingEntryId && (
                  <button onClick={cancelEditEntry} style={{ padding: "9px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                )}
              </div>
            </Card>
            <div style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: T3, marginTop: 2 }}>Journals</div>
            <Journals
              entries={entries}
              editingEntryId={editingEntryId}
              onEdit={startEditEntry}
              onDelete={deleteEntry}
              relativeDateLabel={relativeDateLabel}
              today={today}
              onExport={(f) => toast(`Exported ${f.label}`, { tone: "success" })}
            />
            <ModeHistoryStrip />
          </div>
        )}

        {/* ══ PURITY ══ */}
        {loaded && tab === "purity" && <PurityTab />}
      </div>
    </div>
  );
}
