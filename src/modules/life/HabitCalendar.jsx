// ── Screen 3 · Calendar & Streaks (Loop layout, gold tokens) ─────────────
// Flows inside the Detail scroll. Card A is a TRADITIONAL single-month grid
// (Su–Sa header, day-numbered cells aligned to weekday columns — not
// week-columns), with an EDIT toggle for past-date entry and a tap popover.
// Card B is best streaks; Card C is the Mon–Sun frequency row. Colours are
// our gold tokens + the fixed heatmap ramp (spec §1). Real habit-log data only.
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isScheduled, isDone, isSkipped, valueOn } from "../../shared/habitEngine.js";
import { localDateStr } from "../../shared/dates.js";
import { HT, HEATMAP_RAMP, fmtCellValue } from "./habitTheme.js";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const numeric = (h) => (h.target || 1) > 1;
const pad = (n) => String(n).padStart(2, "0");
const dsOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function HabitCalendar({ habit, onSetValue, onClear, onSkip }) {
  return (
    <>
      <HeatmapCard habit={habit} onSetValue={onSetValue} onClear={onClear} onSkip={onSkip} />
      <StreaksCard habit={habit} />
      <FrequencyCard habit={habit} />
    </>
  );
}

// ── Card A — traditional month grid ──────────────────────────────────────────
function HeatmapCard({ habit, onSetValue, onClear, onSkip }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() }); // visible month
  const [editMode, setEditMode] = useState(false);
  const [pop, setPop] = useState(null); // { ds, rect } view popover
  const [edit, setEdit] = useState(null); // { ds } edit popover
  const today = localDateStr();

  const typicalMax = useMemo(() => {
    let mx = habit.target || 1;
    for (const e of Object.values(habit.log || {})) mx = Math.max(mx, e?.v || 0);
    return mx;
  }, [habit]);

  const { y, m } = ym;
  const firstDow = new Date(y, m, 1).getDay();          // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);  // leading blanks
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const rampIndex = (ds) => {
    if (ds > today) return -1;                          // future
    if (numeric(habit)) {
      const v = valueOn(habit, ds);
      return v > 0 ? Math.min(4, Math.max(1, Math.ceil((v / typicalMax) * 4))) : null;
    }
    return isDone(habit, ds) ? 4 : null;                // boolean: logged → top shade
  };

  const shiftMonth = (delta) => setYm(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const atCurrentMonth = y === now.getFullYear() && m === now.getMonth();

  const onCell = (ds, rect) => { if (editMode) setEdit({ ds }); else setPop({ ds, rect }); };

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: HT.textSecondary, letterSpacing: 0.5 }}>Calendar</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: HT.textSecondary, padding: "3px 9px", border: `1px solid ${HT.border}`, borderRadius: 7 }}>Month ▾</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <NavBtn onClick={() => shiftMonth(-1)}><ChevronLeft size={15} /></NavBtn>
        <span style={{ fontSize: 13, fontWeight: 600, color: HT.textPrimary }}>{new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <NavBtn onClick={() => shiftMonth(1)} disabled={atCurrentMonth}><ChevronRight size={15} /></NavBtn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {DOW.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 9, color: HT.textSecondary, paddingBottom: 2 }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const ds = dsOf(y, m, d);
          const idx = rampIndex(ds);
          const future = idx === -1;
          const bg = future ? "transparent" : idx === null ? HT.cellEmpty : HEATMAP_RAMP[idx];
          const lit = idx !== null && idx >= 2;
          return (
            <button key={ds} disabled={future} aria-label={ds}
              onClick={(e) => onCell(ds, e.currentTarget.getBoundingClientRect())}
              style={{ aspectRatio: "1 / 1", borderRadius: 5, background: bg, border: `1px solid ${future ? "transparent" : HT.border}`, cursor: future ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: future ? HT.border : lit ? HT.bgPage : HT.textSecondary, fontFamily: "monospace" }}>{d}</span>
            </button>
          );
        })}
      </div>

      <div style={{ textAlign: "center", marginTop: 12 }}>
        <button onClick={() => setEditMode((e) => !e)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: editMode ? HT.gold : HT.textSecondary, fontFamily: "inherit" }}>
          {editMode ? "DONE" : "EDIT"}
        </button>
      </div>

      {pop && <ViewPopover habit={habit} pop={pop} onClose={() => setPop(null)} />}
      {edit && <EditPopover habit={habit} ds={edit.ds} onClose={() => setEdit(null)} onSetValue={onSetValue} onClear={onClear} onSkip={onSkip} />}
    </Panel>
  );
}

function ViewPopover({ habit, pop, onClose }) {
  const label = new Date(`${pop.ds}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const done = isDone(habit, pop.ds), skipped = isSkipped(habit, pop.ds), v = valueOn(habit, pop.ds);
  const valueText = numeric(habit) ? (v > 0 ? fmtCellValue(v, habit.unit) : "not logged") : done ? "completed" : skipped ? "skipped" : "not logged";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }}>
      <div style={{ position: "fixed", left: Math.min(pop.rect.left, window.innerWidth - 180), top: pop.rect.bottom + 6, zIndex: 41, background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 9, padding: "8px 11px", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 11.5, color: HT.textPrimary, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: HT.gold, marginTop: 2 }}>{valueText}</div>
      </div>
    </div>
  );
}

// Manual past-date entry (opened via EDIT). Writes through the same habit
// mutations as the list, so nothing here is faked.
function EditPopover({ habit, ds, onClose, onSetValue, onClear, onSkip }) {
  const isNum = numeric(habit);
  const [val, setVal] = useState(valueOn(habit, ds) || (habit.target || 1));
  const act = (fn) => { fn?.(); onClose(); };
  const label = new Date(`${ds}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 300, background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 14, padding: 18, boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: HT.textPrimary }}>{habit.name}</div>
        <div style={{ fontSize: 11, color: HT.textSecondary, marginBottom: 14 }}>{label}</div>
        {isNum ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <input autoFocus type="number" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value === "" ? "" : Number(e.target.value))}
                style={{ flex: 1, background: HT.bgPage, border: `1px solid ${HT.border}`, borderRadius: 9, padding: "10px 12px", fontSize: 15, color: HT.textPrimary, outline: "none", fontFamily: "monospace" }} />
              {habit.unit && <span style={{ fontSize: 12, color: HT.textSecondary }}>{habit.unit}</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Solid onClick={() => act(() => onSetValue?.(habit.id, ds, Number(val) || 0))}>Save</Solid>
              <Ghost onClick={() => act(() => onClear?.(habit.id, ds))}>Clear</Ghost>
              <Ghost onClick={() => act(() => onSkip?.(habit.id, ds))}>Skip</Ghost>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Solid onClick={() => act(() => onSetValue?.(habit.id, ds, habit.target || 1))}>Done</Solid>
            <Ghost onClick={() => act(() => onClear?.(habit.id, ds))}>Missed</Ghost>
            <Ghost onClick={() => act(() => onSkip?.(habit.id, ds))}>Skip</Ghost>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card B — best streaks ────────────────────────────────────────────────────
function StreaksCard({ habit }) {
  const streaks = useMemo(() => computeStreaks(habit), [habit]);
  return (
    <Panel>
      <span style={{ fontSize: 12, color: HT.textSecondary, letterSpacing: 0.5 }}>best streaks</span>
      {streaks.length === 0 ? (
        <div style={{ fontSize: 12.5, color: HT.textSecondary, marginTop: 10 }}>No streaks yet — complete this habit to start one.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {streaks.map((s, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, color: HT.textSecondary }}>{shortDate(s.start)}</span>
                <span style={{ fontSize: 10.5, color: HT.textSecondary }}>{shortDate(s.end)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 8, background: HT.cellEmpty, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(s.length / streaks[0].length) * 100}%`, height: "100%", background: HT.gold, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: HT.gold, fontFamily: "monospace", width: 34, textAlign: "right" }}>{s.length}d</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function computeStreaks(habit) {
  const dates = Object.keys(habit.log || {}).sort();
  if (!dates.length) return [];
  const today = localDateStr();
  let cursor = habit.createdAt && habit.createdAt <= dates[0] ? habit.createdAt : dates[0];
  const runs = [];
  let run = 0, runStart = null, runEnd = null, guard = 0;
  while (cursor <= today && guard++ < 4000) {
    if (isScheduled(habit, cursor)) {
      if (isDone(habit, cursor)) { if (run === 0) runStart = cursor; run++; runEnd = cursor; }
      else if (!isSkipped(habit, cursor)) { if (run > 0) runs.push({ start: runStart, end: runEnd, length: run }); run = 0; }
    }
    cursor = addDays(cursor, 1);
  }
  if (run > 0) runs.push({ start: runStart, end: runEnd, length: run });
  return runs.sort((a, b) => b.length - a.length).slice(0, 5);
}

// ── Card C — frequency ───────────────────────────────────────────────────────
function FrequencyCard({ habit }) {
  const days = Array.isArray(habit.days) ? habit.days : [];
  const ROW = [1, 2, 3, 4, 5, 6, 0]; // Mon…Sun
  const L = { 0: "S", 1: "M", 2: "T", 3: "W", 4: "T", 5: "F", 6: "S" };
  return (
    <Panel>
      <span style={{ fontSize: 12, color: HT.textSecondary, letterSpacing: 0.5 }}>frequency</span>
      <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "space-between", maxWidth: 300 }}>
        {ROW.map((d) => {
          const on = days.includes(d);
          return (
            <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: on ? HT.gold : HT.cellEmpty, border: `1px solid ${on ? HT.gold : HT.border}` }} />
              <span style={{ fontSize: 10, color: on ? HT.textPrimary : HT.textSecondary }}>{L[d]}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── shared ───────────────────────────────────────────────────────────────────
const Panel = ({ children }) => (
  <div style={{ background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 12, padding: "14px 16px" }}>{children}</div>
);
const NavBtn = ({ children, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{ width: 26, height: 26, borderRadius: 7, background: HT.bgPage, border: `1px solid ${HT.border}`, color: disabled ? HT.border : HT.textSecondary, cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</button>
);
const Solid = ({ children, onClick }) => (
  <button onClick={onClick} style={{ flex: 1, padding: 9, background: HT.gold, border: "none", borderRadius: 9, color: HT.bgPage, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{children}</button>
);
const Ghost = ({ children, onClick }) => (
  <button onClick={onClick} style={{ flex: 1, padding: 9, background: "transparent", border: `1px solid ${HT.border}`, borderRadius: 9, color: HT.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{children}</button>
);

const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return localDateStr(d); };
const shortDate = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
