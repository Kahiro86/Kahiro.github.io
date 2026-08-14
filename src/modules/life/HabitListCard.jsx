// ── Screen 1 · Habit List (Loop flat-table clone) ────────────────────────
// A flat table, not cards: one shared column header (day-of-week + date) over
// thin habit rows with a 0.5px divider between them. Left column: icon + name
// (aligned). Then one icon-only cell per day — no background fills or boxes,
// per Loop's table layout. Colours are our gold tokens; the score-colour rule
// lives in habitTheme.getScoreColor and is used on the Detail/Calendar screens
// (the list shows no score, matching Loop).
import { useState } from "react";
import { Check, X, SkipForward } from "lucide-react";
import { isScheduled, isDone, isSkipped, valueOn } from "../../shared/habitEngine.js";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import { HT, frequencyLabel, fmtCellValue } from "./habitTheme.js";

const FIVE_DAYS = [4, 3, 2, 1, 0]; // oldest → newest, left → right
const CELL = 34, GAP = 4, ROW_H = 40;
const numeric = (h) => (h.target || 1) > 1;

// Shared column header — blank name column, then the 5 date columns.
export function HabitListHeader() {
  const todayStr = localDateStr();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: "2px 14px 6px" }}>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: GAP }}>
        {FIVE_DAYS.map(daysAgoStr).map((ds) => {
          const d = new Date(`${ds}T12:00:00`);
          const c = ds === todayStr ? HT.textPrimary : HT.textSecondary;
          return (
            <div key={ds} style={{ width: CELL, textAlign: "center" }}>
              <div style={{ fontSize: 8.5, color: c, letterSpacing: 0.5 }}>{d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: "monospace" }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One thin habit row. `indent` nests routine members under their header.
export function HabitListCard({ habit, indent = false, onOpenDetail, onToggle, onSetValue, onClear, onSkip }) {
  const [editor, setEditor] = useState(null); // numeric quick-entry only
  const isNum = numeric(habit);
  const todayStr = localDateStr();
  const days = FIVE_DAYS.map(daysAgoStr);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: ROW_H, paddingLeft: indent ? 30 : 14, paddingRight: 14 }}>
        {/* name column — the tap target for Detail */}
        <div onClick={() => onOpenDetail(habit)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9, cursor: "pointer", height: "100%" }}>
          <span style={{ fontSize: 16, width: 20, textAlign: "center", flexShrink: 0 }}>{habit.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: HT.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{habit.name}</span>
        </div>
        {/* day cells */}
        <div style={{ display: "flex", gap: GAP }}>
          {days.map((ds) => (
            <DayCell key={ds} habit={habit} ds={ds} isToday={ds === todayStr} isNum={isNum}
              onToggle={() => onToggle(habit.id, ds)} onNumeric={() => setEditor({ ds })} />
          ))}
        </div>
      </div>
      <div style={{ height: 1, background: HT.border }} />
      {editor && (
        <NumericEntry habit={habit} ds={editor.ds} onClose={() => setEditor(null)}
          onSetValue={onSetValue} onClear={onClear} onSkip={onSkip} />
      )}
    </div>
  );
}

function DayCell({ habit, ds, isToday, isNum, onToggle, onNumeric }) {
  const scheduled = isScheduled(habit, ds);
  const done = isDone(habit, ds);
  const skipped = isSkipped(habit, ds) && !done;
  const v = valueOn(habit, ds);

  let content = null;
  if (isNum) {
    // numeric: logged value as plain text, right-aligned; blank when unlogged
    if (v > 0) content = <span style={{ fontSize: 12, color: HT.textPrimary, fontFamily: "monospace" }}>{fmtCellValue(v, "")}</span>;
    else if (skipped) content = <SkipForward size={12} color={HT.textSecondary} />;
  } else {
    if (done) content = <Check size={17} color={HT.gold} strokeWidth={2.6} />;
    else if (skipped) content = <SkipForward size={13} color={HT.textSecondary} />;
    else if (isToday) content = <span style={{ width: 15, height: 15, borderRadius: "50%", border: `1.5px solid ${HT.gold}` }} />;
    else if (scheduled) content = <X size={15} color={HT.textSecondary} />;
    // unscheduled past → blank
  }

  return (
    <button onClick={isNum ? onNumeric : onToggle} aria-label={`${habit.name} ${ds}`}
      style={{ width: CELL, height: CELL, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit", flexShrink: 0 }}>
      {content}
    </button>
  );
}

// Numeric quick-entry popover (boolean days toggle in place, no popover).
function NumericEntry({ habit, ds, onClose, onSetValue, onClear, onSkip }) {
  const [val, setVal] = useState(valueOn(habit, ds) || (habit.target || 1));
  const act = (fn) => { fn(); onClose(); };
  const label = ds === localDateStr() ? "Today" : new Date(`${ds}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 300, background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 14, padding: 18, boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: HT.textPrimary }}>{habit.name}</div>
        <div style={{ fontSize: 11, color: HT.textSecondary, marginBottom: 14 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <input autoFocus type="number" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value === "" ? "" : Number(e.target.value))}
            style={{ flex: 1, background: HT.bgPage, border: `1px solid ${HT.border}`, borderRadius: 9, padding: "10px 12px", fontSize: 15, color: HT.textPrimary, outline: "none", fontFamily: "monospace" }} />
          {habit.unit && <span style={{ fontSize: 12, color: HT.textSecondary }}>{habit.unit}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => act(() => onSetValue(habit.id, ds, Number(val) || 0))} style={{ flex: 1, padding: 9, background: HT.gold, border: "none", borderRadius: 9, color: HT.bgPage, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
          <button onClick={() => act(() => onClear(habit.id, ds))} style={ghost}>Clear</button>
          <button onClick={() => act(() => onSkip(habit.id, ds))} style={ghost}>Skip</button>
        </div>
      </div>
    </div>
  );
}

const ghost = { flex: 1, padding: 9, background: "transparent", border: `1px solid ${HT.border}`, borderRadius: 9, color: HT.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
