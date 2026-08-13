// ── Gym Wave 4 · Routines ─────────────────────────────────────────────────
// Saved workout templates: a named ordered list of exercises you can start a
// session from in one tap. Stored raw in `architect:gym_routines`; the Gym
// facet wires these components into its Workout tab (a compact quick-start
// list) and a full-screen manager for create/edit/delete.
import { useState, useMemo, useRef, useEffect } from "react";
import { Dumbbell, Plus, X, Trash2, Play, Search, Pencil, Check, ChevronLeft } from "lucide-react";
import { B1, B2, BD, T1, T2, T3, GL, AC, AC2, RE } from "../../shared/designTokens.js";
import { Empty } from "../../shared/ui.jsx";
import { searchExercises, getExercise, MUSCLE_NAME } from "./engine.js";

export const newRoutineId = () => `gr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function sanitizeRoutines(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((r) => r && typeof r === "object" && r.id && typeof r.name === "string")
    .map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon || "🏋️",
      exerciseIds: (Array.isArray(r.exerciseIds) ? r.exerciseIds : []).filter((id) => getExercise(id)),
    }));
}

// Compact quick-start list shown on the Workout start screen.
export function RoutineQuickList({ routines, onStart, onManage }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: T3, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>Routines</span>
        <button onClick={onManage} style={{ background: "transparent", border: "none", color: AC, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
          <Pencil size={12} />Manage
        </button>
      </div>
      {routines.length === 0 ? (
        <button onClick={onManage} style={{ padding: "12px", background: GL, border: `1px dashed ${AC}44`, borderRadius: 11, color: AC, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={14} />Create a routine
        </button>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
          {routines.map((r) => (
            <button key={r.id} onClick={() => onStart(r)} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "13px 14px", background: B1, border: `1px solid ${BD}`, borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 17 }}>{r.icon}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10.5, color: T3 }}>{r.exerciseIds.length} exercise{r.exerciseIds.length !== 1 ? "s" : ""}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: AC }}><Play size={11} />Start</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Full-screen manager: list → editor. Saves through onSave (whole array).
export function RoutineManager({ routines, onSave, onClose }) {
  const [editing, setEditing] = useState(null); // routine draft or null

  const save = (draft) => {
    const clean = { ...draft, name: draft.name.trim() || "Routine", exerciseIds: draft.exerciseIds };
    onSave((prev) => {
      const list = sanitizeRoutines(prev);
      return list.some((r) => r.id === clean.id) ? list.map((r) => (r.id === clean.id ? clean : r)) : [...list, clean];
    });
    setEditing(null);
  };
  const remove = (id) => onSave((prev) => sanitizeRoutines(prev).filter((r) => r.id !== id));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, height: "88vh", background: B1, borderTop: `1px solid ${BD}`, borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", boxShadow: "0 -20px 50px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 10 }}>
          {editing && <button onClick={() => setEditing(null)} aria-label="Back" style={hdrBtn}><ChevronLeft size={18} /></button>}
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: T1 }}>{editing ? (editing._new ? "New routine" : "Edit routine") : "Routines"}</span>
          <button onClick={onClose} aria-label="Close" style={hdrBtn}><X size={17} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {editing ? (
            <RoutineEditor draft={editing} onChange={setEditing} onSave={save} />
          ) : (
            <>
              <button onClick={() => setEditing({ id: newRoutineId(), name: "", icon: "🏋️", exerciseIds: [], _new: true })}
                style={{ width: "100%", padding: "12px", background: `linear-gradient(135deg,${AC},${AC2})`, border: "none", borderRadius: 11, color: "#000", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
                <Plus size={15} />New routine
              </button>
              {routines.length === 0 ? (
                <Empty icon="📋" title="No routines yet" sub="Bundle the exercises you do together so a session starts in one tap." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {routines.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: B1, border: `1px solid ${BD}`, borderRadius: 11 }}>
                      <span style={{ fontSize: 18 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{r.name}</div>
                        <div style={{ fontSize: 10.5, color: T3 }}>{r.exerciseIds.length} exercise{r.exerciseIds.length !== 1 ? "s" : ""}</div>
                      </div>
                      <button onClick={() => setEditing({ ...r })} aria-label="Edit" style={rowBtn}><Pencil size={13} /></button>
                      <button onClick={() => remove(r.id)} aria-label="Delete" style={{ ...rowBtn, color: RE }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RoutineEditor({ draft, onChange, onSave }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => (q.trim() ? searchExercises(q).slice(0, 30) : []), [q]);
  const has = (id) => draft.exerciseIds.includes(id);
  const toggle = (id) => onChange({ ...draft, exerciseIds: has(id) ? draft.exerciseIds.filter((x) => x !== id) : [...draft.exerciseIds, id] });
  const chosen = draft.exerciseIds.map(getExercise).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["🏋️", "🌅", "🌙", "💪", "🦵", "🔥", "🧘"].map((ic) => (
          <button key={ic} onClick={() => onChange({ ...draft, icon: ic })} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, cursor: "pointer", background: draft.icon === ic ? `${AC}22` : GL, border: `1px solid ${draft.icon === ic ? AC + "66" : BD}` }}>{ic}</button>
        ))}
        <input autoFocus value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Routine name (e.g. Push Day)"
          style={{ flex: 1, minWidth: 150, background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit" }} />
      </div>

      {chosen.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 }}>{chosen.length} in this routine</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {chosen.map((ex) => (
              <div key={ex.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", background: `${AC}10`, border: `1px solid ${AC}33`, borderRadius: 9 }}>
                <Dumbbell size={13} color={AC} />
                <span style={{ flex: 1, fontSize: 12.5, color: T1 }}>{ex.name}</span>
                <button onClick={() => toggle(ex.id)} aria-label="Remove" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 3 }}><X size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px" }}>
          <Search size={15} color={T3} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add exercises…" style={{ flex: 1, background: "transparent", border: "none", color: T1, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        </div>
        {results.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {results.map((ex) => {
              const on = has(ex.id);
              const primary = ex.muscles.filter((m) => m.primaryMover).map((m) => MUSCLE_NAME[m.muscle]).filter(Boolean).slice(0, 2).join(" · ");
              return (
                <button key={ex.id} onClick={() => toggle(ex.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, border: `1px solid ${on ? AC + "55" : "transparent"}`, background: on ? `${AC}12` : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: T1 }}>{ex.name}</div>
                    {primary && <div style={{ fontSize: 10, color: T3 }}>{primary}</div>}
                  </div>
                  {on ? <Check size={15} color={AC} /> : <Plus size={15} color={T3} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={() => onSave(draft)} disabled={!draft.exerciseIds.length}
        style={{ padding: "12px", background: draft.exerciseIds.length ? `linear-gradient(135deg,${AC},${AC2})` : GL, border: "none", borderRadius: 11, color: draft.exerciseIds.length ? "#000" : T3, fontSize: 13, fontWeight: 800, cursor: draft.exerciseIds.length ? "pointer" : "default", fontFamily: "inherit" }}>
        Save routine
      </button>
    </div>
  );
}

const hdrBtn = { background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: 6, color: T2, cursor: "pointer", display: "flex" };
const rowBtn = { background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 8px", color: T2, cursor: "pointer", display: "flex" };
