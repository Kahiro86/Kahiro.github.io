// ── Body — training and fuel, one domain (spec §2.1) ─────────────────────
// Gym absorbed Nutrition. Training and eating are the same day's decision, so
// they share a screen: Today carries the session and the fuel log in one
// scroll, and the day's training state moves the day's calorie and carb
// targets through bodyTargets.js. Trends puts weight, waist, strength and
// adherence on one x-axis; Coach reflects the logs back without prescribing.
//
// The session itself is unchanged from the GymXP port — stored raw, with its
// XP/PR/muscle summary derived by GymXP's engine and fed to Kaizen's shared
// level and consistency via gymStore.gymSessionsToWorkouts.
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dumbbell, Plus, Check, X, Search, Trash2, Trophy, Clock, TrendingUp, Activity, Timer,
  MessageCircle, Utensils,
} from "lucide-react";
import { B1, B2, BD, T1, T2, T3, GL, AC, AC2, GR, RE, AM, PU } from "../../shared/designTokens.js";
import { Card, SH, Meter, Empty } from "../../shared/ui.jsx";
import { Ring } from "../../shared/charts.jsx";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr } from "../../shared/dates.js";
import { searchExercises, getExercise, MUSCLE_NAME, gymLevel, GROUPS, MUSCLES, rankForMuscleXp, groupRollup, DISCIPLINES } from "./engine.js";
import { sanitizeSessions, sortedByDate, weeklyStreak, newSetFrom, lastPerformance } from "./gymSessions.js";
import { computeAllSummaries } from "./gymStore.js";
import { RoutineQuickList, RoutineManager, sanitizeRoutines } from "./GymRoutines.jsx";
import { MuscleRadar } from "./BodyMap.jsx";
import { RestTimer } from "./RestTimer.jsx";
import { NutritionTab } from "../athlete/NutritionTab.jsx";
import { BodyTrends } from "./BodyTrends.jsx";
import { BodyCoachPanel } from "./BodyCoachPanel.jsx";

const today = () => localDateStr();
const uid = () => `gs${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Which inputs a set needs, from the exercise's load type.
function setFields(exerciseId) {
  const ex = getExercise(exerciseId);
  const lt = ex?.loadType;
  if (lt === "time") return { duration: true };
  if (lt === "distance") return { distance: true };
  const weighted = lt === "weighted_bodyweight" || lt === "assisted";
  const bodyweightOnly = lt === "bodyweight";
  return { weight: !bodyweightOnly, reps: true, addedWeight: weighted };
}

export function BodyOS({ navHint } = {}) {
  const [tab, setTab] = useState("today");
  const [rawSessions, setSessions, loaded] = useStorageState("gym_sessions", []);
  const [active, setActive] = useStorageState("gym_active", null);
  const [profile, setProfile] = useStorageState("gym_profile", { bodyweightKg: 75 });
  const [summaryId, setSummaryId] = useState(null); // session id whose summary modal is open
  const [searchOpen, setSearchOpen] = useState(false);
  const [rawRoutines, setRoutines] = useStorageState("gym_routines", []);
  const [mgrOpen, setMgrOpen] = useState(false);
  const toast = useToast();

  // Deep links: the retired Nutrition facet pointed at "athlete"/"fuel", and
  // the old Gym tabs at "workout"/"progress". Both land on their new home.
  useEffect(() => {
    const g = navHint?.group;
    if (!g) return;
    if (g === "history") setTab("history");
    else if (g === "progress" || g === "trends") setTab("trends");
    else if (g === "coach") setTab("coach");
    else if (g === "workout" || g === "athlete" || g === "fuel" || g === "today") setTab("today");
  }, [navHint?.nonce]); // eslint-disable-line

  const sessions = useMemo(() => sanitizeSessions(rawSessions), [rawSessions]);
  const derived = useMemo(() => computeAllSummaries(sessions), [sessions]);
  const ordered = useMemo(() => sortedByDate(sessions).reverse(), [sessions]); // newest first
  const routines = useMemo(() => sanitizeRoutines(rawRoutines), [rawRoutines]);

  const bw = Number(profile?.bodyweightKg) || 75;
  const streak = useMemo(() => weeklyStreak(sessions), [sessions]);
  const thisWeek = useMemo(() => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
    const cut = localDateStr(weekAgo);
    return sessions.filter((s) => s.date >= cut).length;
  }, [sessions]);
  const lifeLvl = gymLevel(derived.lifetimeXp);

  // ── active-session mutations ───────────────────────────────────────────
  const start = () => setActive({ startedAt: Date.now(), bodyweightKg: bw, entries: [] });
  const startFromRoutine = (r) => {
    setActive({
      startedAt: Date.now(), bodyweightKg: bw,
      entries: r.exerciseIds.map((id) => { const ex = getExercise(id); return { exerciseId: id, name: ex?.name || id, sets: [newSetFrom(null, bw)] }; }),
    });
    toast(`${r.icon} ${r.name} loaded`, { tone: "success", duration: 2000 });
  };
  const cancel = () => { setActive(null); toast("Workout discarded", { tone: "info" }); };
  const addExercise = (ex) => {
    setActive((a) => a && ({ ...a, entries: [...a.entries, { exerciseId: ex.id, name: ex.name, sets: [newSetFrom(null, a.bodyweightKg)] }] }));
    setSearchOpen(false);
  };
  const patchSet = (ei, si, patch) => setActive((a) => {
    const entries = a.entries.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map((s, j) => j !== si ? s : { ...s, ...patch }) });
    return { ...a, entries };
  });
  const addSet = (ei) => setActive((a) => {
    const e = a.entries[ei]; const last = e.sets[e.sets.length - 1];
    return { ...a, entries: a.entries.map((x, i) => i !== ei ? x : { ...x, sets: [...x.sets, newSetFrom(last, a.bodyweightKg)] }) };
  });
  const removeSet = (ei, si) => setActive((a) => ({ ...a, entries: a.entries.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) }) }));
  const removeExercise = (ei) => setActive((a) => ({ ...a, entries: a.entries.filter((_, i) => i !== ei) }));

  const hasWork = active?.entries?.some((e) => e.sets.some((s) => (Number(s.reps) > 0 || Number(s.durationSec) > 0 || Number(s.distanceM) > 0)));

  const finish = () => {
    if (!active) return;
    // keep only sets with a real quantity entered
    const entries = active.entries
      .map((e) => ({ ...e, sets: e.sets.filter((s) => Number(s.reps) > 0 || Number(s.durationSec) > 0 || Number(s.distanceM) > 0) }))
      .filter((e) => e.sets.length > 0);
    if (!entries.length) { toast("Log at least one set first", { tone: "info" }); return; }
    const session = { id: uid(), date: today(), startedAt: active.startedAt, finishedAt: Date.now(), bodyweightKg: active.bodyweightKg, entries };
    setSessions((prev) => [...(Array.isArray(prev) ? prev : []), session]);
    if (Number(active.bodyweightKg) > 0 && Number(active.bodyweightKg) !== bw) setProfile((p) => ({ ...(p || {}), bodyweightKg: Number(active.bodyweightKg) }));
    setActive(null);
    setTab("history");
    setSummaryId(session.id);
    toast("Workout logged 💪 — XP added", { tone: "success", duration: 3500 });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tabs={[{ id: "today", l: "Today", i: Dumbbell }, { id: "trends", l: "Trends", i: Activity }, { id: "coach", l: "Coach", i: MessageCircle }, { id: "history", l: "History", i: Clock }]}
        active={tab} onSelect={setTab} activeBg={`linear-gradient(135deg,${AC}22,${AC}14)`} activeColor={AC}>
        <div style={{ flex: 1 }} />
        {/* A training-volume stat, not a second progression. It counts work
            done in this facet only and never reaches the app's XP or level —
            those come from one engine (src/shared/xp). Labelled so the two
            can't be mistaken for each other. */}
        <div title="Training volume in this facet only — separate from your XP and level"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: `${AC}11`, border: `1px solid ${AC}22`, borderRadius: 9 }}>
          <Dumbbell size={13} color={AC} />
          <span style={{ fontSize: 11, fontWeight: 800, color: AC, letterSpacing: 0.5 }}>TRAINING TIER {lifeLvl.level}</span>
          <Meter pct={Math.round((lifeLvl.xpIntoLevel / Math.max(1, lifeLvl.xpForNext)) * 100)} height={4} fill={`linear-gradient(90deg,${AC}88,${AC2})`} style={{ width: 60 }} />
        </div>
      </ModuleTabs>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {!loaded && <div style={{ padding: 40, textAlign: "center", color: T3, fontSize: 13 }}>Loading…</div>}

        {/* ── Today: the session and the fuel, one scroll, because they are
             the same day's decision (spec §2.1 A). ── */}
        {loaded && tab === "today" && (
          <>
            {!active && (
              <StartScreen onStart={start} last={ordered[0]} lastSummary={ordered[0] && derived.byId[ordered[0].id]}
                thisWeek={thisWeek} streak={streak} total={sessions.length} onOpenLast={() => ordered[0] && setSummaryId(ordered[0].id)}
                routines={routines} onStartRoutine={startFromRoutine} onManageRoutines={() => setMgrOpen(true)} />
            )}
            {active && (
              <ActiveScreen active={active} setActive={setActive} sessions={sessions} onAddExercise={() => setSearchOpen(true)}
                patchSet={patchSet} addSet={addSet} removeSet={removeSet} removeExercise={removeExercise}
                onFinish={finish} onCancel={cancel} canFinish={hasWork} onBw={(v) => setActive((a) => ({ ...a, bodyweightKg: v }))} />
            )}
            <div style={{ padding: "0 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "18px 0 2px", borderTop: `1px solid ${BD}`, marginTop: 4 }}>
                <Utensils size={15} color={AC2} />
                <span style={{ fontSize: 13.5, fontWeight: 800, color: T1, letterSpacing: 0.3 }}>Fuel</span>
                <span style={{ fontSize: 10.5, color: T3 }}>targets follow the day's training</span>
              </div>
            </div>
            <NutritionTab />
          </>
        )}

        {loaded && tab === "trends" && (
          <>
            <BodyTrends sessions={sessions} />
            <ProgressScreen sessions={ordered} byId={derived.byId} muscleTotals={derived.muscleTotals} lifetimeXp={derived.lifetimeXp} />
          </>
        )}

        {loaded && tab === "coach" && <BodyCoachPanel sessions={sessions} />}

        {loaded && tab === "history" && (
          <HistoryScreen sessions={ordered} byId={derived.byId} onOpen={setSummaryId} lifetimeXp={derived.lifetimeXp} />
        )}
      </div>

      {searchOpen && <ExerciseSearch onPick={addExercise} onClose={() => setSearchOpen(false)} />}
      {summaryId && (() => {
        const s = sessions.find((x) => x.id === summaryId);
        return s ? <SummaryModal session={s} summary={derived.byId[s.id]} onClose={() => setSummaryId(null)} /> : null;
      })()}
      {mgrOpen && <RoutineManager routines={routines} onSave={setRoutines} onClose={() => setMgrOpen(false)} />}
    </div>
  );
}

// ── Start ──────────────────────────────────────────────────────────────────
function StartScreen({ onStart, last, lastSummary, thisWeek, streak, total, onOpenLast, routines, onStartRoutine, onManageRoutines }) {
  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 18, maxWidth: 620, margin: "0 auto" }}>
      <Card style={{ padding: "26px 22px", textAlign: "center", background: `linear-gradient(180deg,${AC}0E,transparent)` }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🏋️</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: T1, marginBottom: 4 }}>Ready to train</div>
        <div style={{ fontSize: 12.5, color: T2, marginBottom: 18, lineHeight: 1.55 }}>Every set logged pays XP and feeds your streak. The smallest session still counts.</div>
        <button onClick={onStart} style={{ padding: "13px 30px", background: `linear-gradient(135deg,${AC},${AC2})`, border: "none", borderRadius: 12, color: "#000", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Dumbbell size={17} />Start Workout
        </button>
      </Card>

      <RoutineQuickList routines={routines} onStart={onStartRoutine} onManage={onManageRoutines} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11 }}>
        {[
          { l: "This week", v: thisWeek, s: "sessions", c: AC },
          { l: "Week streak", v: streak, s: streak === 1 ? "week" : "weeks", c: AM },
          { l: "Lifetime", v: total, s: "sessions", c: PU },
        ].map((x) => (
          <Card key={x.l} style={{ padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: x.c, fontFamily: "'JetBrains Mono',monospace" }}>{x.v}</div>
            <div style={{ fontSize: 10.5, color: T2, marginTop: 2 }}>{x.l}</div>
            <div style={{ fontSize: 9.5, color: T3 }}>{x.s}</div>
          </Card>
        ))}
      </div>

      {last && lastSummary && (
        <Card style={{ padding: "16px 18px", cursor: "pointer" }} onClick={onOpenLast}>
          <SH title="Last workout" sub={last.date} action={<TrendingUp size={13} color={AC} />} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
            <span style={{ fontSize: 12, color: T2 }}>{last.entries.length} exercise{last.entries.length !== 1 ? "s" : ""}</span>
            <span style={{ fontSize: 12, color: T2 }}>{lastSummary.totalSets} sets</span>
            <span style={{ fontSize: 12, color: AC, fontWeight: 700 }}>+{lastSummary.xpTotal} XP</span>
            {lastSummary.prs.length > 0 && <span style={{ fontSize: 12, color: AM, display: "flex", alignItems: "center", gap: 4 }}><Trophy size={11} />{lastSummary.prs.length} PR</span>}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Active session ───────────────────────────────────────────────────────────
function ActiveScreen({ active, sessions, onAddExercise, patchSet, addSet, removeSet, removeExercise, onFinish, onCancel, canFinish, onBw }) {
  const elapsed = useElapsed(active.startedAt);
  const [restOpen, setRestOpen] = useState(false);
  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 680, margin: "0 auto" }}>
      <Card style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: RE, boxShadow: `0 0 8px ${RE}`, animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: T1, fontFamily: "monospace" }}>{elapsed}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: T3 }}>BW</span>
          <input type="number" inputMode="decimal" value={active.bodyweightKg ?? ""} onChange={(e) => onBw(Number(e.target.value))}
            style={{ width: 58, background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "5px 8px", fontSize: 12, color: T1, outline: "none", fontFamily: "monospace", textAlign: "center" }} />
          <span style={{ fontSize: 11, color: T3 }}>kg</span>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setRestOpen((o) => !o)} title="Rest timer" aria-label="Rest timer" style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${restOpen ? AC + "66" : BD}`, background: restOpen ? `${AC}18` : GL, color: restOpen ? AC : T2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Timer size={15} /></button>
        <button onClick={onCancel} style={{ padding: "7px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Discard</button>
        <button onClick={onFinish} disabled={!canFinish} style={{ padding: "7px 16px", background: canFinish ? `linear-gradient(135deg,${GR},${AC2})` : GL, border: "none", borderRadius: 9, color: canFinish ? "#000" : T3, fontSize: 12.5, fontWeight: 800, cursor: canFinish ? "pointer" : "default", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><Check size={14} />Finish</button>
      </Card>

      {active.entries.length === 0 && (
        <Empty icon="➕" pad={30} title="No exercises yet" sub="Add your first exercise to start logging sets." />
      )}

      {active.entries.map((e, ei) => (
        <ExerciseCard key={ei} entry={e} ei={ei} sessions={sessions} patchSet={patchSet} addSet={addSet} removeSet={removeSet} removeExercise={removeExercise} />
      ))}

      <button onClick={onAddExercise} style={{ padding: "12px", background: GL, border: `1px dashed ${AC}55`, borderRadius: 12, color: AC, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <Plus size={15} />Add Exercise
      </button>

      {restOpen && <RestTimer onClose={() => setRestOpen(false)} />}
    </div>
  );
}

function ExerciseCard({ entry, ei, sessions, patchSet, addSet, removeSet, removeExercise }) {
  const f = setFields(entry.exerciseId);
  const last = useMemo(() => lastPerformance(sessions, entry.exerciseId), [sessions, entry.exerciseId]);
  return (
    <Card style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: last ? 4 : 10 }}>
        <Dumbbell size={15} color={AC} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: T1 }}>{entry.name}</span>
        <button onClick={() => removeExercise(ei)} aria-label="Remove exercise" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 4 }}><Trash2 size={13} /></button>
      </div>
      {last && (
        <div style={{ fontSize: 10.5, color: T3, marginBottom: 10, paddingLeft: 23, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Last · {dateLabel(last.date)}: {last.sets.slice(0, 4).map((s) => fmtSetShort(s, entry.exerciseId)).join("  ")}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {entry.sets.map((s, si) => (
          <div key={si} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 20, fontSize: 11, color: T3, fontFamily: "monospace", textAlign: "center", flexShrink: 0 }}>{si + 1}</span>
            {(f.weight || f.addedWeight) && (
              <SetInp value={s.weightKg} onChange={(v) => patchSet(ei, si, { weightKg: v })} label={f.addedWeight ? "+kg" : "kg"} />
            )}
            {f.reps && <SetInp value={s.reps} onChange={(v) => patchSet(ei, si, { reps: v })} label="reps" />}
            {f.duration && <SetInp value={s.durationSec} onChange={(v) => patchSet(ei, si, { durationSec: v })} label="sec" />}
            {f.distance && <SetInp value={s.distanceM} onChange={(v) => patchSet(ei, si, { distanceM: v })} label="m" />}
            <div style={{ flex: 1 }} />
            <button onClick={() => removeSet(ei, si)} aria-label="Remove set" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 4 }}><X size={13} /></button>
          </div>
        ))}
      </div>
      <button onClick={() => addSet(ei)} style={{ marginTop: 9, padding: "7px 12px", background: `${AC}12`, border: `1px solid ${AC}33`, borderRadius: 8, color: AC, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}><Plus size={12} />Add set</button>
    </Card>
  );
}

function SetInp({ value, onChange, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <input type="number" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        placeholder="0" style={{ width: 56, background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "7px 8px", fontSize: 13, color: T1, outline: "none", fontFamily: "monospace", textAlign: "center" }} />
      <span style={{ fontSize: 10.5, color: T3 }}>{label}</span>
    </div>
  );
}

// ── History ──────────────────────────────────────────────────────────────────
function HistoryScreen({ sessions, byId, onOpen, lifetimeXp }) {
  if (!sessions.length) return <div style={{ padding: 24 }}><Empty icon="📜" title="No workouts yet" sub="Finish your first session and it lands here with its full XP breakdown." /></div>;
  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 680, margin: "0 auto" }}>
      <div style={{ fontSize: 11.5, color: T3 }}>{sessions.length} workout{sessions.length !== 1 ? "s" : ""} · {lifetimeXp.toLocaleString()} lifetime training points</div>
      {sessions.map((s) => {
        const sum = byId[s.id] || { totalSets: 0, xpTotal: 0, prs: [], totalVolume: 0 };
        return (
          <Card key={s.id} style={{ padding: "14px 16px", cursor: "pointer" }} onClick={() => onOpen(s.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${AC}14`, border: `1px solid ${AC}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Dumbbell size={17} color={AC} /></div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{dateLabel(s.date)}</div>
                <div style={{ fontSize: 11, color: T3, marginTop: 1 }}>{s.entries.length} exercise{s.entries.length !== 1 ? "s" : ""} · {sum.totalSets} sets · {sum.totalVolume.toLocaleString()} vol</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: AC, fontFamily: "monospace" }}>+{sum.xpTotal}</div>
                {sum.prs.length > 0 && <div style={{ fontSize: 10, color: AM, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}><Trophy size={9} />{sum.prs.length} PR</div>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── Progress — muscle ranks + PRs ────────────────────────────────────────────
const RANK_COLOR = { unranked: "#5A5348", F: "#6B6456", E: "#8A8378", D: "#A67D1F", C: "#C9962B", B: AC, A: AC2, S: GR };
const rankColor = (r) => RANK_COLOR[r] || "#5A5348";

function RankBadge({ rank, size = 26 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 7, background: `${rankColor(rank)}22`, border: `1px solid ${rankColor(rank)}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.5, fontWeight: 900, color: rankColor(rank), fontFamily: "monospace" }}>{rank === "unranked" ? "–" : rank}</span>
    </div>
  );
}

function ProgressScreen({ sessions, byId, muscleTotals, lifetimeXp }) {
  if (!sessions.length) {
    return <div style={{ padding: 24 }}><Empty icon="🗺️" title="No muscle map yet" sub="Log a workout and your muscles start ranking up here." /></div>;
  }
  const groups = groupRollup(muscleTotals);
  const byGroupId = Object.fromEntries(groups.map((g) => [g.id, g]));
  const maxMuscle = Math.max(1, ...MUSCLES.map((m) => muscleTotals[m.id] || 0));

  const prs = [];
  for (const s of sessions) {
    const sum = byId[s.id];
    if (sum?.prs?.length) for (const pr of sum.prs) prs.push({ ...pr, date: s.date });
  }

  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 680, margin: "0 auto" }}>
      <div style={{ fontSize: 11.5, color: T3 }}>{lifetimeXp.toLocaleString()} lifetime training points · muscles ranked F→S by work done</div>

      <Card style={{ padding: "16px" }}>
        <SH title="Muscle radar" sub="Rank reach across the six groups" />
        <MuscleRadar muscleTotals={muscleTotals} />
      </Card>

      {GROUPS.map((g) => {
        const gr = byGroupId[g.id] || { xp: 0, rank: "unranked" };
        const muscles = MUSCLES.filter((m) => m.groupId === g.id);
        return (
          <Card key={g.id} style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <RankBadge rank={gr.rank} size={30} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{g.displayName}</div>
                <div style={{ fontSize: 10.5, color: T3 }}>{Math.round(gr.xp).toLocaleString()} muscle XP</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {muscles.map((m) => {
                const xp = muscleTotals[m.id] || 0;
                const rank = rankForMuscleXp(xp);
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 92, fontSize: 11, color: T2, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.displayName}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: BD, overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(2, (xp / maxMuscle) * 100)}%`, height: "100%", background: rankColor(rank), borderRadius: 3 }} />
                    </div>
                    <span style={{ width: 16, textAlign: "center", fontSize: 10.5, fontWeight: 800, color: rankColor(rank), fontFamily: "monospace", flexShrink: 0 }}>{rank === "unranked" ? "–" : rank}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Card style={{ padding: "14px 16px" }}>
        <SH title="Personal records" sub={prs.length ? `${prs.length} all-time` : "none yet"} action={<Trophy size={13} color={AM} />} />
        {prs.length === 0 ? (
          <div style={{ fontSize: 12, color: T3, padding: "6px 0" }}>Beat a past best — heavier, more reps, or more volume — to set your first PR.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
            {prs.slice(0, 15).map((pr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: i < Math.min(prs.length, 15) - 1 ? `1px solid ${BD}` : "none" }}>
                <Trophy size={12} color={AM} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: T1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prLabel(pr)}</span>
                <span style={{ fontSize: 10.5, color: T3, flexShrink: 0 }}>{dateLabel(pr.date)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Exercise search sheet ────────────────────────────────────────────────────
function ExerciseSearch({ onPick, onClose }) {
  const [q, setQ] = useState("");
  // The catalog covers nine kinds of training, and typing is a poor way to
  // reach eleven stretches you do not yet know the names of. The chips are
  // how you browse a discipline; the box is how you find a lift you can name.
  const [disc, setDisc] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const results = useMemo(
    () => searchExercises(q, disc ? { discipline: disc } : {}).slice(0, 80),
    [q, disc],
  );
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "82vh", background: B1, borderTop: `1px solid ${BD}`, borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", boxShadow: "0 -20px 50px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Search size={16} color={T3} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises…"
            style={{ flex: 1, background: "transparent", border: "none", color: T1, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          <button onClick={onClose} aria-label="Close" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: 6, color: T2, cursor: "pointer", display: "flex" }}><X size={15} /></button>
        </div>
        <div style={{ display: "flex", gap: 5, padding: "9px 12px", borderBottom: `1px solid ${BD}`, overflowX: "auto" }}>
          {[{ id: null, label: "All" }, ...DISCIPLINES.map((d) => ({ id: d.id, label: d.label }))].map((d) => {
            const on = disc === d.id;
            return (
              <button key={d.id ?? "all"} onClick={() => setDisc(d.id)} aria-pressed={on}
                style={{ padding: "4px 10px", borderRadius: 9, fontSize: 11, whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${on ? AC + "66" : BD}`, background: on ? `${AC}18` : "transparent", color: on ? AC : T3 }}>
                {d.label}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {results.length === 0 && <div style={{ padding: 30, textAlign: "center", color: T3, fontSize: 12.5 }}>No matches.</div>}
          {results.map((ex) => {
            const primary = ex.muscles.filter((m) => m.primaryMover).map((m) => MUSCLE_NAME[m.muscle]).filter(Boolean).slice(0, 3).join(" · ");
            return (
              <button key={ex.id} onClick={() => onPick(ex)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = GL; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${AC}14`, border: `1px solid ${AC}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Dumbbell size={15} color={AC} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{ex.name}</div>
                  <div style={{ fontSize: 10.5, color: T3, marginTop: 1, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ color: ex.trainingEffect === "load" ? T3 : AC2 }}>
                      {DISCIPLINES.find((d) => d.id === ex.discipline)?.label || ex.discipline}
                    </span>
                    {primary && <span>· {primary}</span>}
                  </div>
                </div>
                <Plus size={15} color={AC} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Session summary ──────────────────────────────────────────────────────────
function SummaryModal({ session, summary, onClose }) {
  if (!summary) return null;
  const topMuscles = Object.entries(summary.muscleXp || {}).filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxM = topMuscles[0]?.[1] || 1;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.66)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", background: B1, border: `1px solid ${BD}`, borderRadius: 16, padding: "22px 20px", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T1 }}>{dateLabel(session.date)}</span>
          <button onClick={onClose} aria-label="Close" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: 6, color: T2, cursor: "pointer", display: "flex" }}><X size={15} /></button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
          <Ring pct={100} glow color={AC} size={92} stroke={8}>
            <div style={{ fontSize: 21, fontWeight: 900, color: AC, fontFamily: "'JetBrains Mono',monospace" }}>+{summary.xpTotal}</div>
            <div style={{ fontSize: 8, color: T3, letterSpacing: 1.5 }}>GYM XP</div>
          </Ring>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Stat label="Exercises" value={session.entries.length} />
            <Stat label="Sets" value={summary.totalSets} />
            <Stat label="Volume" value={summary.totalVolume.toLocaleString()} />
          </div>
        </div>

        {summary.prs.length > 0 && (
          <div style={{ marginBottom: 14, padding: "11px 13px", background: `${AM}0E`, border: `1px solid ${AM}33`, borderRadius: 11 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: AM, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><Trophy size={13} />{summary.prs.length} personal record{summary.prs.length !== 1 ? "s" : ""}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {summary.prs.map((pr, i) => (
                <span key={i} style={{ fontSize: 10.5, color: T2, padding: "3px 8px", background: GL, borderRadius: 7, border: `1px solid ${BD}` }}>
                  {prLabel(pr)}
                </span>
              ))}
            </div>
          </div>
        )}

        {topMuscles.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: T3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Muscles trained</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topMuscles.map(([m, v]) => (
                <div key={m} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 96, fontSize: 11.5, color: T2, flexShrink: 0 }}>{MUSCLE_NAME[m] || m}</span>
                  <Meter pct={(v / maxM) * 100} color={AC} style={{ flex: 1 }} />
                  <span style={{ width: 34, textAlign: "right", fontSize: 11, color: T3, fontFamily: "monospace" }}>{Math.round(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <span style={{ fontSize: 11.5, color: T3 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: T1, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function useElapsed(startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return (h ? `${h}:` : "") + `${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

function dateLabel(ds) {
  if (ds === today()) return "Today";
  const d = new Date(`${ds}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Compact one-token summary of a logged set, by the exercise's load type.
function fmtSetShort(s, exerciseId) {
  const f = setFields(exerciseId);
  if (f.duration) return `${s.durationSec ?? 0}s`;
  if (f.distance) return `${s.distanceM ?? 0}m`;
  const reps = s.reps ?? 0;
  if ((f.weight || f.addedWeight) && s.weightKg) return `${s.weightKg}×${reps}`;
  return `${reps}`;
}

function prLabel(pr) {
  const kind = pr.type === "weight" ? "Weight" : pr.type === "rep" ? "Reps" : pr.type === "volume" ? "Volume" : pr.type === "bodyweightMax" ? "Bodyweight high" : pr.type === "bodyweightMin" ? "Bodyweight low" : "PR";
  const ex = getExercise(pr.exerciseId);
  return `${ex ? ex.name + " · " : ""}${kind} ${Math.round(pr.value)}`;
}
