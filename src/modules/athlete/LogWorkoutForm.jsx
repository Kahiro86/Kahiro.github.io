import { useState } from "react";
import { Trash2, X, Plus, CheckCircle, Save, Zap } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, CY, PU, GR, AM, RE } from "../../shared/designTokens.js";
import { Fld, Inp, Radio, DirTogGeneric } from "../../shared/ui.jsx";
import { localDateStr } from "../../shared/dates.js";
import { uidA } from "./helpers.js";
import { uidE, MUSCLE_GROUPS, EQUIPMENT } from "./library.js";

export function LogWorkoutForm({ onSave, onCancel, exerciseLib = [], setExerciseLib, templates = [], onSaveTemplate, initial, lastValues = {} }) {
  const seed = initial || {};
  const [type, setType] = useState(seed.type || "strength");
  const [name, setName] = useState(seed.name || "");
  const [date, setDate] = useState(localDateStr());
  const [exercises, setExercises] = useState(
    seed.exercises && seed.exercises.length
      ? seed.exercises.map((e) => ({ id: uidA(), name: e.name, sets: (e.sets || [{ reps: "", weight: "" }]).map((s) => ({ reps: s.reps ?? "", weight: s.weight ?? "" })) }))
      : [{ id: uidA(), name: "", sets: [{ reps: "", weight: "" }] }]
  );
  const [duration, setDuration] = useState(seed.duration || "");
  const [intensity, setIntensity] = useState(seed.intensity || "Moderate");
  const [notes, setNotes] = useState("");
  const [newEx, setNewEx] = useState(null); // { forRowId, name, muscle, equipment, defSets, defReps, defWeight }

  const libByName = Object.fromEntries(exerciseLib.map((e) => [e.name, e]));

  const addExercise = () => setExercises((p) => [...p, { id: uidA(), name: "", sets: [{ reps: "", weight: "" }] }]);
  const removeExercise = (id) => setExercises((p) => p.filter((e) => e.id !== id));
  const addSet = (id) => setExercises((p) => p.map((e) => (e.id === id ? { ...e, sets: [...e.sets, { ...(e.sets[e.sets.length - 1] || { reps: "", weight: "" }) }] } : e)));
  const removeSet = (id, idx) => setExercises((p) => p.map((e) => (e.id === id ? { ...e, sets: e.sets.filter((_, i) => i !== idx) } : e)));
  const setSetVal = (id, idx, key, v) => setExercises((p) => p.map((e) => (e.id === id ? { ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, [key]: v } : s)) } : e)));

  // Selecting a library exercise auto-fills prior values (or the exercise defaults).
  const pickExercise = (rowId, exName) => {
    if (exName === "__new__") { setNewEx({ forRowId: rowId, name: "", muscle: "Other", equipment: "Barbell", defSets: 3, defReps: 8, defWeight: "" }); return; }
    const prev = lastValues[exName];
    const lib = libByName[exName];
    let sets;
    if (prev && prev.length) sets = prev.map((s) => ({ reps: s.reps ?? "", weight: s.weight ?? "" }));
    else if (lib) sets = Array.from({ length: +lib.defSets || 1 }, () => ({ reps: lib.defReps ?? "", weight: lib.defWeight ?? "" }));
    else sets = [{ reps: "", weight: "" }];
    setExercises((p) => p.map((e) => (e.id === rowId ? { ...e, name: exName, sets } : e)));
  };

  const saveNewExercise = () => {
    if (!newEx.name.trim()) { setNewEx(null); return; }
    const ex = { id: uidE(), name: newEx.name.trim(), muscle: newEx.muscle, equipment: newEx.equipment, defSets: +newEx.defSets || 3, defReps: +newEx.defReps || 8, defWeight: newEx.defWeight, notes: "" };
    setExerciseLib((prev) => (prev.some((x) => x.name.toLowerCase() === ex.name.toLowerCase()) ? prev : [...prev, ex]));
    const sets = Array.from({ length: ex.defSets }, () => ({ reps: ex.defReps, weight: ex.defWeight }));
    setExercises((p) => p.map((e) => (e.id === newEx.forRowId ? { ...e, name: ex.name, sets } : e)));
    setNewEx(null);
  };

  const totalVolume = type === "strength"
    ? exercises.reduce((s, e) => s + e.sets.reduce((ss, st) => ss + (+st.reps || 0) * (+st.weight || 0), 0), 0)
    : 0;

  const buildWorkout = () => ({
    id: uidA(), type, name: name || (type === "strength" ? "Strength Session" : "Cardio Session"),
    date, duration: +duration || 0, intensity, notes, createdAt: new Date().toISOString(),
    exercises: type === "strength" ? exercises.filter((e) => e.name.trim()) : [],
    totalVolume,
  });

  const submit = () => onSave(buildWorkout());
  const saveTemplate = () => {
    const w = buildWorkout();
    onSaveTemplate({
      name: w.name, type: w.type, duration: w.duration, intensity: w.intensity,
      exercises: w.exercises.map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ reps: s.reps, weight: s.weight })) })),
    });
  };

  const loadTemplate = (tpl) => {
    setType(tpl.type); setName(tpl.name); setDuration(tpl.duration || ""); setIntensity(tpl.intensity || "Moderate");
    setExercises((tpl.exercises && tpl.exercises.length)
      ? tpl.exercises.map((e) => ({ id: uidA(), name: e.name, sets: (e.sets || [{ reps: "", weight: "" }]).map((s) => ({ reps: s.reps ?? "", weight: s.weight ?? "" })) }))
      : [{ id: uidA(), name: "", sets: [{ reps: "", weight: "" }] }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 22px", borderBottom: `1px solid ${BD}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: B1, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>Log Workout</div>
        <div style={{ display: "flex", gap: 8 }}>
          {onSaveTemplate && <button onClick={saveTemplate} style={{ display: "flex", alignItems: "center", gap: 5, background: `${PU}18`, border: `1px solid ${PU}44`, borderRadius: 8, padding: "7px 12px", color: PU, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}><Save size={12} />Save as Template</button>}
          <button onClick={onCancel} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "7px 13px", color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
        {templates.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 }}>Quick-load a template</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {templates.map((tpl) => (
                <button key={tpl.id} onClick={() => loadTemplate(tpl)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, border: `1px solid ${CY}44`, background: `${CY}14`, color: CY, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
                  <Zap size={11} />{tpl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Fld label="Type"><DirTogGeneric value={type} onChange={setType} options={[{ v: "strength", l: "STRENGTH" }, { v: "cardio", l: "CARDIO" }]} /></Fld>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
          <Fld label="Date"><Inp type="date" value={date} onChange={setDate} /></Fld>
          <Fld label="Session Name"><Inp value={name} onChange={setName} placeholder={type === "strength" ? "e.g. Push Day" : "e.g. Morning Run"} /></Fld>
        </div>

        {type === "strength" ? (
          <div>
            {exercises.map((ex) => (
              <div key={ex.id} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: "14px", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <select value={libByName[ex.name] ? ex.name : (ex.name ? ex.name : "")} onChange={(e) => pickExercise(ex.id, e.target.value)}
                    style={{ flex: 1, background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, color: ex.name ? T1 : T3, outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
                    <option value="">Select exercise...</option>
                    {ex.name && !libByName[ex.name] && <option value={ex.name}>{ex.name}</option>}
                    {exerciseLib.map((x) => <option key={x.id} value={x.name}>{x.name}{x.muscle ? ` · ${x.muscle}` : ""}</option>)}
                    <option value="__new__">＋ Add new exercise…</option>
                  </select>
                  {exercises.length > 1 && (
                    <button onClick={() => removeExercise(ex.id)} style={{ background: "none", border: `1px solid ${RE}33`, borderRadius: 8, padding: "0 10px", cursor: "pointer", color: RE }}><Trash2 size={13} /></button>
                  )}
                </div>
                {lastValues[ex.name] && (
                  <div style={{ fontSize: 10, color: T3, marginBottom: 8 }}>↺ Auto-filled from your last {ex.name} session</div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 28px", gap: 7, marginBottom: 5 }}>
                  {["#", "Reps", "Weight (kg)", ""].map((h) => <div key={h} style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{h}</div>)}
                </div>
                {ex.sets.map((s, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 28px", gap: 7, marginBottom: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: T3, textAlign: "center" }}>{i + 1}</span>
                    <input type="number" value={s.reps} onChange={(e) => setSetVal(ex.id, i, "reps", e.target.value)} placeholder="10"
                      style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, color: T1, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
                    <input type="number" value={s.weight} onChange={(e) => setSetVal(ex.id, i, "weight", e.target.value)} placeholder="40"
                      style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, color: T1, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }} />
                    {ex.sets.length > 1 && (
                      <button onClick={() => removeSet(ex.id, i)} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", display: "flex", justifyContent: "center" }}><X size={12} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => addSet(ex.id)} style={{ marginTop: 6, padding: "5px 11px", background: "transparent", border: `1px dashed ${BD2}`, borderRadius: 7, color: T2, fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                  <Plus size={11} />Add Set
                </button>
              </div>
            ))}
            <button onClick={addExercise} style={{ width: "100%", padding: "10px", background: GL, border: `1px dashed ${BD2}`, borderRadius: 10, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
              <Plus size={13} />Add Exercise
            </button>
            {totalVolume > 0 && (
              <div style={{ padding: "11px 14px", background: `${PU}0A`, border: `1px solid ${PU}22`, borderRadius: 10, marginBottom: 14, fontSize: 12, color: T2 }}>
                <strong style={{ color: PU }}>Total Volume: </strong>{totalVolume.toLocaleString()} kg lifted
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            <Fld label="Duration (minutes)"><Inp type="number" value={duration} onChange={setDuration} placeholder="45" mono /></Fld>
            <Fld label="Intensity"><Radio value={intensity} onChange={setIntensity} options={["Easy", "Moderate", "Hard"]} color={CY} /></Fld>
          </div>
        )}

        <Fld label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? Anything to remember..."
            style={{ width: "100%", minHeight: 70, background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 13px", fontSize: 13, color: T1, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </Fld>
      </div>

      {newEx && (
        <>
          <div onClick={() => setNewEx(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(420px,92vw)", background: B1, border: `1px solid ${BD2}`, borderRadius: 16, padding: "20px", zIndex: 61 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>New Exercise</div>
              <button onClick={() => setNewEx(null)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            <input value={newEx.name} onChange={(e) => setNewEx((n) => ({ ...n, name: e.target.value }))} placeholder="Exercise name" autoFocus
              style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", marginBottom: 11, boxSizing: "border-box" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 11 }}>
              <label><span style={{ fontSize: 10, color: T3, textTransform: "uppercase" }}>Muscle</span>
                <select value={newEx.muscle} onChange={(e) => setNewEx((n) => ({ ...n, muscle: e.target.value }))} style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px", fontSize: 12.5, color: T1, marginTop: 4, fontFamily: "inherit" }}>
                  {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label><span style={{ fontSize: 10, color: T3, textTransform: "uppercase" }}>Equipment</span>
                <select value={newEx.equipment} onChange={(e) => setNewEx((n) => ({ ...n, equipment: e.target.value }))} style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px", fontSize: 12.5, color: T1, marginTop: 4, fontFamily: "inherit" }}>
                  {EQUIPMENT.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[{ k: "defSets", l: "Sets" }, { k: "defReps", l: "Reps" }, { k: "defWeight", l: "Weight" }].map((f) => (
                <label key={f.k}><span style={{ fontSize: 10, color: T3, textTransform: "uppercase" }}>{f.l}</span>
                  <input type="number" value={newEx[f.k]} onChange={(e) => setNewEx((n) => ({ ...n, [f.k]: e.target.value }))} style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px", fontSize: 12.5, color: T1, marginTop: 4, fontFamily: "monospace", boxSizing: "border-box" }} />
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setNewEx(null)} style={{ padding: "8px 14px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={saveNewExercise} style={{ padding: "8px 16px", background: `linear-gradient(135deg,${PU},${CY})`, border: "none", borderRadius: 9, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add & Use</button>
            </div>
          </div>
        </>
      )}

      <div style={{ padding: "13px 22px", borderTop: `1px solid ${BD}`, display: "flex", justifyContent: "flex-end", background: B1 }}>
        <button onClick={submit} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 22px", background: `linear-gradient(135deg,${PU},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <CheckCircle size={14} />Save Workout
        </button>
      </div>
    </div>
  );
}
