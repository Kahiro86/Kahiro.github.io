// ── Screen 1 · Habit List (Loop look) ────────────────────────────────────
// Borderless list rows under one shared date header — Loop's exact layout.
// Each habit is tinted in its OWN colour (habit.color), which drives its day
// cells. Boolean days are circular checks in the habit colour; numeric days
// show the logged value. Today toggles; past days open a quick-edit; the row
// body opens Detail. No per-row score — Loop keeps that in Detail.
import { useState } from "react";
import { Check, X, SkipForward } from "lucide-react";
import { isScheduled, isDone, isSkipped, valueOn } from "../../shared/habitEngine.js";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import { HT, frequencyLabel, fmtCellValue } from "./habitTheme.js";

const FIVE_DAYS = [4, 3, 2, 1, 0]; // oldest → newest, left → right
const CELL = 32, GAP = 6;

// Shared column header (weekday + day-of-month), rendered once above the list.
export function HabitListHeader() {
  const todayStr = localDateStr();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: "4px 14px 8px" }}>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: GAP }}>
        {FIVE_DAYS.map(daysAgoStr).map((ds) => {
          const d = new Date(`${ds}T12:00:00`);
          const today = ds === todayStr;
          const c = today ? HT.textPrimary : HT.textSecondary;
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

export function HabitListCard({ habit, onOpenDetail, onToggle, onSetValue, onSkip, onClear }) {
  const [editor, setEditor] = useState(null);
  const accent = habit.color || HT.gold;
  const numeric = (habit.target || 1) > 1;
  const todayStr = localDateStr();
  const days = FIVE_DAYS.map(daysAgoStr);

  const onCellActivate = (ds) => {
    const isToday = ds === todayStr;
    if (numeric) { setEditor({ ds }); return; }
    if (isToday) { onToggle(habit.id, ds); return; }
    setEditor({ ds });
  };

  return (
    <div>
      <div onClick={() => onOpenDetail(habit)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}1A`, border: `1px solid ${accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{habit.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: HT.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{habit.name}</div>
          <div style={{ fontSize: 10, color: HT.textSecondary, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{habit.category} · {frequencyLabel(habit)}</div>
        </div>
        <div style={{ display: "flex", gap: GAP }} onClick={(e) => e.stopPropagation()}>
          {days.map((ds) => (
            <DayCell key={ds} habit={habit} accent={accent} ds={ds} isToday={ds === todayStr} numeric={numeric} onActivate={onCellActivate} />
          ))}
        </div>
      </div>
      <div style={{ height: 1, background: HT.border, marginLeft: 60 }} />
      {editor && (
        <CellEditor habit={habit} accent={accent} ds={editor.ds} numeric={numeric}
          onClose={() => setEditor(null)} onSetValue={onSetValue} onSkip={onSkip} onClear={onClear} />
      )}
    </div>
  );
}

function DayCell({ habit, accent, ds, isToday, numeric, onActivate }) {
  const scheduled = isScheduled(habit, ds);
  const done = isDone(habit, ds);
  const skipped = isSkipped(habit, ds) && !done;
  const v = valueOn(habit, ds);
  const interactive = numeric || isToday || (scheduled && !isToday);

  let bg = "transparent", border = "none", content = null, radius = "50%";

  if (numeric) {
    radius = 8;
    if (v > 0) content = <span style={{ fontSize: 10.5, fontWeight: 700, color: accent, fontFamily: "monospace" }}>{fmtCellValue(v, habit.unit)}</span>;
    else if (skipped) content = <SkipForward size={11} color={HT.textSecondary} />;
    else if (isToday) { bg = `${accent}12`; border = `1.5px solid ${accent}`; }
    else content = <span style={{ fontSize: 12, color: HT.textSecondary }}>–</span>;
  } else {
    if (done) { bg = accent; content = <Check size={16} color={HT.bgPage} strokeWidth={3.2} />; }
    else if (isToday) { border = `2px solid ${accent}`; }
    else if (skipped) { border = `1px solid ${HT.border}`; content = <SkipForward size={11} color={HT.textSecondary} />; }
    else if (scheduled) { border = `1px solid ${HT.border}`; content = <X size={13} color={HT.textSecondary} />; }
    else { border = `1px dashed ${HT.border}`; }
  }

  return (
    <button onClick={() => interactive && onActivate(ds)} disabled={!interactive} aria-label={`${habit.name} ${ds}`}
      style={{ width: CELL, height: CELL, borderRadius: radius, background: bg, border, cursor: interactive ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit", flexShrink: 0 }}>
      {content}
    </button>
  );
}

function CellEditor({ habit, accent, ds, numeric, onClose, onSetValue, onSkip, onClear }) {
  const current = valueOn(habit, ds);
  const [val, setVal] = useState(current || (habit.target || 1));
  const act = (fn) => { fn(); onClose(); };
  const label = ds === localDateStr() ? "Today" : new Date(`${ds}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 300, background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 14, padding: "18px", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: HT.textPrimary }}>{habit.name}</div>
        <div style={{ fontSize: 11, color: HT.textSecondary, marginBottom: 14 }}>{label}</div>
        {numeric ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <input autoFocus type="number" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value === "" ? "" : Number(e.target.value))}
                style={{ flex: 1, background: HT.bgPage, border: `1px solid ${HT.border}`, borderRadius: 9, padding: "10px 12px", fontSize: 15, color: HT.textPrimary, outline: "none", fontFamily: "monospace" }} />
              {habit.unit && <span style={{ fontSize: 12, color: HT.textSecondary }}>{habit.unit}</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <BtnAccent accent={accent} onClick={() => act(() => onSetValue(habit.id, ds, Number(val) || 0))}>Save</BtnAccent>
              <BtnGhost onClick={() => act(() => onClear(habit.id, ds))}>Clear</BtnGhost>
              <BtnGhost onClick={() => act(() => onSkip(habit.id, ds))}>Skip</BtnGhost>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <BtnAccent accent={accent} onClick={() => act(() => onSetValue(habit.id, ds, habit.target || 1))}>Done</BtnAccent>
            <BtnGhost onClick={() => act(() => onClear(habit.id, ds))}>Missed</BtnGhost>
            <BtnGhost onClick={() => act(() => onSkip(habit.id, ds))}>Skip</BtnGhost>
          </div>
        )}
      </div>
    </div>
  );
}

const BtnAccent = ({ children, onClick, accent }) => (
  <button onClick={onClick} style={{ flex: 1, padding: "9px", background: accent, border: "none", borderRadius: 9, color: HT.bgPage, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{children}</button>
);
const BtnGhost = ({ children, onClick }) => (
  <button onClick={onClick} style={{ flex: 1, padding: "9px", background: "transparent", border: `1px solid ${HT.border}`, borderRadius: 9, color: HT.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{children}</button>
);
