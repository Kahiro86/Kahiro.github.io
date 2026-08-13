// ── Screen 1 · Habit List card (redesign spec §3) ────────────────────────
// One card per habit: a header row (icon · name · category+frequency · 30-day
// score) over a strip of the last five calendar days. Boolean days toggle;
// numeric days open a value entry; past days open a quick-edit rather than
// silently overwriting; tapping the card body opens the Detail screen.
// Every number is read live from habitEngine — nothing is hardcoded.
import { useState } from "react";
import { Check, X, SkipForward } from "lucide-react";
import { isScheduled, isDone, isSkipped, valueOn, rangeStats } from "../../shared/habitEngine.js";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import { HT, getScoreColor, frequencyLabel, fmtCellValue } from "./habitTheme.js";

const FIVE_DAYS = [4, 3, 2, 1, 0]; // oldest → newest, left → right

export function HabitListCard({ habit, onOpenDetail, onToggle, onSetValue, onSkip, onClear }) {
  const [editor, setEditor] = useState(null); // { ds } — quick-edit / numeric entry
  const numeric = (habit.target || 1) > 1;
  const score = rangeStats(habit, 30).pct;
  const scoreColor = getScoreColor(score);
  const todayStr = localDateStr();
  const days = FIVE_DAYS.map(daysAgoStr);

  const onCellActivate = (ds) => {
    const isToday = ds === todayStr;
    if (numeric) { setEditor({ ds }); return; }          // numeric → value entry
    if (isToday) { onToggle(habit.id, ds); return; }     // today boolean → toggle
    setEditor({ ds });                                    // past boolean → quick-edit
  };

  return (
    <div
      onClick={() => onOpenDetail(habit)}
      style={{ background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}
    >
      {/* Row 1 — identity + 30-day score */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${HT.gold}1A`, border: `1px solid ${HT.gold}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{habit.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: HT.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{habit.name}</div>
          <div style={{ fontSize: 10, color: HT.textSecondary, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{habit.category} · {frequencyLabel(habit)}</div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor, fontFamily: "monospace", flexShrink: 0 }}>{score}%</div>
      </div>

      {/* Row 2 — last five days */}
      <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
        {days.map((ds) => (
          <DayCell key={ds} habit={habit} ds={ds} isToday={ds === todayStr} numeric={numeric} onActivate={onCellActivate} />
        ))}
      </div>

      {editor && (
        <CellEditor
          habit={habit} ds={editor.ds} numeric={numeric}
          onClose={() => setEditor(null)}
          onToggle={onToggle} onSetValue={onSetValue} onSkip={onSkip} onClear={onClear}
        />
      )}
    </div>
  );
}

function DayCell({ habit, ds, isToday, numeric, onActivate }) {
  const scheduled = isScheduled(habit, ds);
  const done = isDone(habit, ds);
  const skipped = isSkipped(habit, ds) && !done;
  const v = valueOn(habit, ds);

  // A cell is interactive when it can meaningfully change: any numeric cell,
  // today's boolean cell, or a past *scheduled* boolean cell (quick-edit).
  const interactive = numeric || isToday || (scheduled && !isToday);

  let bg = HT.cellEmpty;
  let border = "none";
  let content = null;

  if (numeric) {
    if (v > 0) {
      content = <span style={{ fontSize: 10.5, fontWeight: 600, color: HT.gold, fontFamily: "monospace" }}>{fmtCellValue(v, habit.unit)}</span>;
    } else if (skipped) {
      content = <SkipForward size={11} color={HT.textSecondary} />;
    } else if (isToday) {
      border = `1.5px solid ${HT.gold}`;
    } else {
      content = <span style={{ fontSize: 12, color: HT.textSecondary }}>–</span>;
    }
  } else {
    if (done) {
      bg = HT.gold;
      content = <Check size={15} color={HT.bgPage} strokeWidth={3} />;
    } else if (isToday) {
      border = `1.5px solid ${HT.gold}`;
    } else if (skipped) {
      content = <SkipForward size={11} color={HT.textSecondary} />;
    } else if (scheduled) {
      content = <X size={13} color={HT.textSecondary} />;
    } else {
      content = <span style={{ fontSize: 12, color: HT.textSecondary, opacity: 0.5 }}>–</span>; // unscheduled: neutral
    }
  }

  return (
    <button
      onClick={() => interactive && onActivate(ds)}
      disabled={!interactive}
      aria-label={`${habit.name} ${ds}`}
      style={{ flex: 1, height: 30, borderRadius: 7, background: bg, border, cursor: interactive ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: "inherit" }}
    >
      {content}
    </button>
  );
}

// Quick-edit / numeric entry popover — a small centred sheet so past days are
// never silently overwritten (spec §3). Reads the day's current value live.
function CellEditor({ habit, ds, numeric, onClose, onToggle, onSetValue, onSkip, onClear }) {
  const current = valueOn(habit, ds);
  const [val, setVal] = useState(current || (habit.target || 1));
  const label = dsLabel(ds);
  const act = (fn) => { fn(); onClose(); };

  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 300, background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 14, padding: "18px 18px", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
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
              <BtnGold onClick={() => act(() => onSetValue(habit.id, ds, Number(val) || 0))}>Save</BtnGold>
              <BtnGhost onClick={() => act(() => onClear(habit.id, ds))}>Clear</BtnGhost>
              <BtnGhost onClick={() => act(() => onSkip(habit.id, ds))}>Skip</BtnGhost>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <BtnGold onClick={() => act(() => onSetValue(habit.id, ds, habit.target || 1))}>Done</BtnGold>
            <BtnGhost onClick={() => act(() => onClear(habit.id, ds))}>Missed</BtnGhost>
            <BtnGhost onClick={() => act(() => onSkip(habit.id, ds))}>Skip</BtnGhost>
          </div>
        )}
      </div>
    </div>
  );
}

const BtnGold = ({ children, onClick }) => (
  <button onClick={onClick} style={{ flex: 1, padding: "9px", background: HT.gold, border: "none", borderRadius: 9, color: HT.bgPage, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{children}</button>
);
const BtnGhost = ({ children, onClick }) => (
  <button onClick={onClick} style={{ flex: 1, padding: "9px", background: "transparent", border: `1px solid ${HT.border}`, borderRadius: 9, color: HT.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{children}</button>
);

function dsLabel(ds) {
  if (ds === localDateStr()) return "Today";
  const d = new Date(`${ds}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
