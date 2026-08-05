// ── Workout splits — editable day-type templates + weekly plan ───────
// Placeholder structure only; the owner fills in exercises. Supports
// add/remove/reorder, giant-set grouping, duplicate-to-variant, and a
// weekly weekday→split assignment. Today's assigned split shows on top and
// can be run as a checklist.
import { useMemo, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Copy, Link2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, AC, AC2, GR } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { localDateStr } from "../../shared/dates.js";
import {
  EX_TYPES, MUSCLES, DAY_LABEL, DEFAULT_SPLITS, sanitizeSplits, sanitizeWeek,
  newExercise, newSplit, splitForDay, groupedExercises, newGiantId, weekdayKey,
} from "../../shared/workoutSplits.js";
import {
  findSession, loggedForTpl, lastWeightFor, seedLoggedExercise, newSession,
  exerciseVolume, commitSession, dropSession,
} from "../../shared/workoutLog.js";

const inp = { background: B2, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 9px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const chip = (extra = {}) => ({ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", background: GL, border: `1px solid ${BD}`, borderRadius: 8, color: T2, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", ...extra });

export function WorkoutSplits() {
  const ds = localDateStr();
  const [rawSplits, setSplits] = useStorageState("workout_splits", DEFAULT_SPLITS());
  const [rawWeek] = useStorageState("workout_week", {});
  // Single source of truth: ticking an exercise writes straight into the
  // real workout log (athlete_workouts). "Done" is derived from that session —
  // there is no separate checklist store.
  const [rawWorkouts, setWorkouts] = useStorageState("athlete_workouts", []);
  const workouts = Array.isArray(rawWorkouts) ? rawWorkouts : [];
  const splits = useMemo(() => sanitizeSplits(rawSplits), [rawSplits]);
  const week = useMemo(() => sanitizeWeek(rawWeek, splits), [rawWeek, splits]);
  const [sel, setSel] = useState(splits[0]?.id || null);
  const [expanded, setExpanded] = useState({}); // tplId -> inline set editor open
  const editing = splits.find((s) => s.id === sel) || splits[0];
  const today = splitForDay(week, splits, new Date());
  const todaySession = findSession(workouts, ds, today);

  const patchSplit = (id, fn) => setSplits((p) => sanitizeSplits(p).map((s) => (s.id === id ? fn(s) : s)));
  const addEx = () => patchSplit(editing.id, (s) => ({ ...s, exercises: [...s.exercises, newExercise()] }));
  const setEx = (exId, k, v) => patchSplit(editing.id, (s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === exId ? { ...e, [k]: v } : e)) }));
  const delEx = (exId) => patchSplit(editing.id, (s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== exId) }));
  const moveEx = (exId, dir) => patchSplit(editing.id, (s) => { const a = [...s.exercises]; const i = a.findIndex((e) => e.id === exId); const j = i + dir; if (i < 0 || j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return { ...s, exercises: a }; });
  const linkGiant = (exId) => patchSplit(editing.id, (s) => { const a = s.exercises; const i = a.findIndex((e) => e.id === exId); if (i <= 0) return s; const prev = a[i - 1]; const gid = prev.giantSetId || newGiantId(); return { ...s, exercises: a.map((e, k) => (k === i ? { ...e, giantSetId: gid } : k === i - 1 ? { ...e, giantSetId: gid } : e)) }; });
  const unlinkGiant = (exId) => setEx(exId, "giantSetId", null);
  const addSplit = () => { const s = newSplit("New split"); setSplits((p) => [...sanitizeSplits(p), s]); setSel(s.id); };
  const dupSplit = () => { const s = { ...newSplit(`${editing.name} (copy)`), exercises: editing.exercises.map((e) => ({ ...e, id: `ex${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}` })) }; setSplits((p) => [...sanitizeSplits(p), s]); setSel(s.id); };
  const delSplit = () => { setSplits((p) => sanitizeSplits(p).filter((s) => s.id !== editing.id)); setSel(splits[0]?.id || null); };
  // Ticking IS the log. Tick → add this exercise to today's session (one
  // write), seeded from the template and auto-expanded so any weight/rep
  // change is one field away. Un-tick → remove that entry (and the session if
  // it was the last). No second action, no separate delete.
  const commit = (session) => setWorkouts((prev) => commitSession(prev, session));
  const tickExercise = (tplEx) => {
    const existing = todaySession && loggedForTpl(todaySession, tplEx.id);
    if (existing) {
      const rest = todaySession.exercises.filter((e) => e.id !== existing.id);
      setWorkouts((prev) => (rest.length ? commitSession(prev, { ...todaySession, exercises: rest }) : dropSession(prev, todaySession.id)));
      setExpanded((x) => ({ ...x, [tplEx.id]: false }));
    } else {
      const logged = seedLoggedExercise(tplEx, lastWeightFor(workouts, tplEx.name));
      commit(todaySession ? { ...todaySession, exercises: [...todaySession.exercises, logged] } : newSession(today, ds, logged));
      setExpanded((x) => ({ ...x, [tplEx.id]: true }));
    }
  };
  const patchLogged = (logId, fn) => { if (todaySession) commit({ ...todaySession, exercises: todaySession.exercises.map((e) => (e.id === logId ? fn(e) : e)) }); };
  const setSetVal = (logId, idx, key, v) => patchLogged(logId, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, [key]: v } : s)) }));
  const addSet = (logId) => patchLogged(logId, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets[e.sets.length - 1] || { reps: "", weight: "" }) }] }));
  const removeSet = (logId, idx) => patchLogged(logId, (e) => (e.sets.length <= 1 ? e : { ...e, sets: e.sets.filter((_, i) => i !== idx) }));

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
      {/* Today's split as a runnable checklist */}
      <Card style={{ padding: "15px 17px" }}>
        <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, color: T3, marginBottom: 8 }}>Today · {DAY_LABEL[weekdayKey(new Date())]}</div>
        {today ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: T1 }}>{today.name}</span>
              {todaySession && <span style={{ fontSize: 11, color: T3 }}>· {todaySession.exercises.length} logged{todaySession.totalVolume > 0 ? ` · ${todaySession.totalVolume.toLocaleString()} kg` : ""}</span>}
            </div>
            <div style={{ fontSize: 11, color: T3, marginBottom: 10, lineHeight: 1.5 }}>Tick an exercise to log it — it&apos;s pre-filled from the plan, so a tap is enough. Open it to adjust weight or reps.</div>
            {today.exercises.length === 0 ? <div style={{ fontSize: 12.5, color: T3 }}>No exercises in this split yet — add them below.</div> : groupedExercises(today).map((b, bi) => (
              <div key={bi} style={{ marginBottom: 8, ...(b.giant ? { border: `1px solid ${AC}33`, borderRadius: 9, padding: "8px 10px", background: `${AC}08` } : {}) }}>
                {b.giant && <div style={{ fontSize: 9.5, color: AC, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Giant set — back to back</div>}
                {b.items.map((e) => {
                  const logged = todaySession ? loggedForTpl(todaySession, e.id) : null;
                  const on = !!logged;
                  const open = on && expanded[e.id];
                  const weighted = e.type === "weighted";
                  const spec = e.type === "cardio" || e.type === "mobility" ? (e.duration ? `${e.duration}` : "") : [e.sets && `${e.sets}×`, e.reps].filter(Boolean).join("");
                  const vol = logged ? exerciseVolume(logged) : 0;
                  return (
                    <div key={e.id} style={{ borderRadius: 8, marginBottom: 3, ...(on ? { background: `${GR}0a` } : {}) }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 4px" }}>
                        <button onClick={() => tickExercise(e)} aria-label={on ? `Un-log ${e.name}` : `Log ${e.name}`}
                          style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? GR : T3}`, background: on ? GR : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", padding: 0 }}>
                          {on && <Check size={11} color="#04130a" />}
                        </button>
                        <button onClick={() => on && setExpanded((x) => ({ ...x, [e.id]: !x[e.id] }))}
                          style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: on ? "pointer" : "default", textAlign: "left", fontFamily: "inherit", padding: 0, minWidth: 0 }}>
                          <span style={{ fontSize: 13.5, color: on ? T3 : T1, textDecoration: on ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name || "Unnamed"}</span>
                          {e.muscle && <span style={{ fontSize: 8.5, color: AC2, background: `${AC2}14`, border: `1px solid ${AC2}33`, borderRadius: 5, padding: "1px 5px", textTransform: "capitalize", flexShrink: 0 }}>{e.muscle}</span>}
                        </button>
                        <span style={{ fontSize: 11, color: on && vol > 0 ? T2 : T3, fontFamily: "monospace", flexShrink: 0 }}>{on && vol > 0 ? `${vol.toLocaleString()} kg` : spec}</span>
                        {on && (open ? <ChevronUp size={14} color={T3} /> : <ChevronDown size={14} color={T3} />)}
                      </div>
                      {open && logged && (
                        <div style={{ padding: "4px 4px 9px 32px", display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "grid", gridTemplateColumns: weighted ? "18px 1fr 1fr 22px" : "18px 1fr 22px", gap: 6, alignItems: "center" }}>
                            <span />
                            <span style={{ fontSize: 8.5, color: T3, letterSpacing: 1, textTransform: "uppercase", textAlign: "center" }}>reps</span>
                            {weighted && <span style={{ fontSize: 8.5, color: T3, letterSpacing: 1, textTransform: "uppercase", textAlign: "center" }}>kg</span>}
                            <span />
                            {logged.sets.map((s, i) => (
                              <SetRow key={i} n={i + 1} s={s} weighted={weighted}
                                onReps={(v) => setSetVal(logged.id, i, "reps", v)}
                                onWeight={(v) => setSetVal(logged.id, i, "weight", v)}
                                onRemove={logged.sets.length > 1 ? () => removeSet(logged.id, i) : null} />
                            ))}
                          </div>
                          <button onClick={() => addSet(logged.id)} style={chip({ alignSelf: "flex-start", color: GR, borderColor: `${GR}44` })}><Plus size={11} /> Set</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        ) : <div style={{ fontSize: 13, color: T3 }}>No split assigned to today — set the weekly plan in the Week tab.</div>}
      </Card>

      {/* Split editor */}
      <Card style={{ padding: "15px 17px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {splits.map((s) => (
            <button key={s.id} onClick={() => setSel(s.id)} style={chip({ borderColor: sel === s.id ? `${AC2}66` : BD, color: sel === s.id ? AC2 : T2, background: sel === s.id ? `${AC2}12` : GL })}>{s.name}</button>
          ))}
          <button onClick={addSplit} style={chip({ borderColor: `${GR}55`, color: GR })}><Plus size={12} /> Split</button>
        </div>
        {editing && (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input value={editing.name} onChange={(e) => patchSplit(editing.id, (s) => ({ ...s, name: e.target.value }))} style={{ ...inp, flex: 1, fontSize: 14, fontWeight: 700 }} />
              <button onClick={dupSplit} style={chip()}><Copy size={12} /> Duplicate</button>
              <button onClick={delSplit} style={chip({ color: "#F85149", borderColor: "#F8514944" })}><Trash2 size={12} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {editing.exercises.map((e, idx) => (
                <div key={e.id} style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", padding: "7px 8px", background: e.giantSetId ? `${AC}08` : "transparent", border: `1px solid ${e.giantSetId ? AC + "33" : BD}`, borderRadius: 8 }}>
                  <input value={e.name} onChange={(ev) => setEx(e.id, "name", ev.target.value)} placeholder="Exercise" style={{ ...inp, flex: 1, minWidth: 120 }} />
                  <select value={e.type} onChange={(ev) => setEx(e.id, "type", ev.target.value)} style={{ ...inp, width: 100 }}>{EX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                  <select value={e.muscle} onChange={(ev) => setEx(e.id, "muscle", ev.target.value)} title="Muscle group — powers the body map" style={{ ...inp, width: 100, textTransform: "capitalize" }}>
                    <option value="">muscle…</option>
                    {MUSCLES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {e.type === "cardio" || e.type === "mobility"
                    ? <input value={e.duration} onChange={(ev) => setEx(e.id, "duration", ev.target.value)} placeholder="duration" style={{ ...inp, width: 78 }} />
                    : <><input value={e.sets} onChange={(ev) => setEx(e.id, "sets", ev.target.value)} placeholder="sets" style={{ ...inp, width: 50 }} /><input value={e.reps} onChange={(ev) => setEx(e.id, "reps", ev.target.value)} placeholder="reps" style={{ ...inp, width: 58 }} />{e.type === "weighted" && <input value={e.weight} onChange={(ev) => setEx(e.id, "weight", ev.target.value)} placeholder="kg" title="Suggested starting weight" style={{ ...inp, width: 50 }} />}</>}
                  <button onClick={() => moveEx(e.id, -1)} disabled={idx === 0} style={chip({ flex: "none" })}><ArrowUp size={11} /></button>
                  <button onClick={() => moveEx(e.id, 1)} disabled={idx === editing.exercises.length - 1} style={chip({ flex: "none" })}><ArrowDown size={11} /></button>
                  <button onClick={() => (e.giantSetId ? unlinkGiant(e.id) : linkGiant(e.id))} title={e.giantSetId ? "Ungroup" : "Group with the one above (giant set)"} style={chip({ flex: "none", color: e.giantSetId ? AC : T3 })}><Link2 size={11} /></button>
                  <button onClick={() => delEx(e.id)} style={chip({ flex: "none", color: "#F85149", borderColor: "#F8514944" })}><Trash2 size={11} /></button>
                </div>
              ))}
              <button onClick={addEx} style={chip({ borderColor: `${GR}55`, color: GR, alignSelf: "flex-start" })}><Plus size={12} /> Add exercise</button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// One inline set row in the today's-log editor: index + reps (+ weight for
// weighted exercises) + remove. Bodyweight rows omit the weight field.
const nInp = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 6, padding: "5px 6px", fontSize: 11.5, color: T1, outline: "none", fontFamily: "monospace", boxSizing: "border-box", textAlign: "center" };
function SetRow({ n, s, weighted, onReps, onWeight, onRemove }) {
  return (
    <>
      <span style={{ fontSize: 10, color: T3, textAlign: "center" }}>{n}</span>
      <input type="number" inputMode="decimal" value={s.reps} onChange={(e) => onReps(e.target.value)} placeholder="reps" style={nInp} />
      {weighted && <input type="number" inputMode="decimal" value={s.weight} onChange={(e) => onWeight(e.target.value)} placeholder="kg" style={nInp} />}
      {onRemove
        ? <button onClick={onRemove} aria-label="Remove set" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", justifyContent: "center", padding: 0 }}><Trash2 size={11} /></button>
        : <span />}
    </>
  );
}
