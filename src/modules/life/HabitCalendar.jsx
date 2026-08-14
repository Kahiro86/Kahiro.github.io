// ── Screen 3 · Calendar & Streaks (spec §5) ──────────────────────────────
// Reached from Detail's Stats|Calendar toggle. Three cards: a horizontal-week
// heatmap (weeks as columns, 7 day-rows, most recent on the right), the best
// streaks as proportional bars, and a Mon–Sun frequency row. All from the real
// habit log — no mock data, no crash on an empty habit.
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isScheduled, isDone, isSkipped, valueOn } from "../../shared/habitEngine.js";
import { localDateStr } from "../../shared/dates.js";
import { HT, habitRamp, fmtCellValue } from "./habitTheme.js";

const WEEKS = 13;           // visible window
const DAY_ROWS = [1, 2, 3, 4, 5, 6, 0]; // Mon…Sun (getDay indices)
const DAY_LETTER = { 0: "S", 1: "M", 2: "T", 3: "W", 4: "T", 5: "F", 6: "S" };
const numeric = (h) => (h.target || 1) > 1;

const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return localDateStr(d); };
const mondayOf = (ds) => { const d = new Date(`${ds}T12:00:00`); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return localDateStr(d); };

export function HabitCalendar({ habit }) {
  return (
    <>
      <HeatmapCard habit={habit} />
      <StreaksCard habit={habit} />
      <FrequencyCard habit={habit} />
    </>
  );
}

// ── Card A — heatmap ─────────────────────────────────────────────────────────
function HeatmapCard({ habit }) {
  const [offset, setOffset] = useState(0); // windows back from now
  const [pop, setPop] = useState(null);     // { ds, v, x, y }
  const today = localDateStr();
  const RAMP = habitRamp(habit.color || HT.gold); // Loop tints the calendar in the habit colour

  const typicalMax = useMemo(() => {
    let m = habit.target || 1;
    for (const e of Object.values(habit.log || {})) m = Math.max(m, e?.v || 0);
    return m;
  }, [habit]);

  // Column-major weeks: the visible window ends `offset` windows before today.
  const lastMonday = mondayOf(addDays(today, -offset * WEEKS * 7));
  const firstMonday = addDays(lastMonday, -(WEEKS - 1) * 7);
  const weeks = Array.from({ length: WEEKS }, (_, w) => addDays(firstMonday, w * 7));

  const rampIndex = (ds) => {
    if (ds > today) return -1;                // future
    const v = valueOn(habit, ds);
    const scheduled = isScheduled(habit, ds);
    if (numeric(habit)) {
      if (v <= 0) return 0;
      return Math.min(4, Math.max(1, Math.ceil((v / typicalMax) * 4)));
    }
    if (isDone(habit, ds)) return 4;
    if (isSkipped(habit, ds)) return 1;
    return scheduled ? 0 : 0;
  };

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: HT.textSecondary, letterSpacing: 0.5 }}>{monthSpan(firstMonday, addDays(lastMonday, 6))}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <NavBtn onClick={() => setOffset((o) => o + 1)}><ChevronLeft size={15} /></NavBtn>
          <NavBtn onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0}><ChevronRight size={15} /></NavBtn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {/* day-row labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 0 }}>
          {DAY_ROWS.map((d, i) => (
            <div key={i} style={{ height: 15, display: "flex", alignItems: "center", fontSize: 8.5, color: HT.textSecondary }}>{DAY_LETTER[d]}</div>
          ))}
        </div>
        <div style={{ flex: 1, overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 3, minWidth: "min-content" }}>
            {weeks.map((weekStart, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {DAY_ROWS.map((_, ri) => {
                  const ds = addDays(weekStart, ri);
                  const idx = rampIndex(ds);
                  const color = idx < 0 ? "transparent" : RAMP[idx];
                  return (
                    <button key={ri} aria-label={ds} disabled={idx < 0}
                      onClick={(e) => setPop({ ds, v: valueOn(habit, ds), rect: e.currentTarget.getBoundingClientRect() })}
                      style={{ width: 15, height: 15, borderRadius: 3, background: color, border: idx < 0 ? "none" : `1px solid ${HT.border}`, cursor: idx < 0 ? "default" : "pointer", padding: 0 }} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* legend */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 10 }}>
        <span style={{ fontSize: 9, color: HT.textSecondary }}>less</span>
        {RAMP.map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: 2, background: c, border: `1px solid ${HT.border}` }} />)}
        <span style={{ fontSize: 9, color: HT.textSecondary }}>more</span>
      </div>

      {pop && <CellPopover habit={habit} pop={pop} onClose={() => setPop(null)} />}
    </Panel>
  );
}

function CellPopover({ habit, pop, onClose }) {
  const label = new Date(`${pop.ds}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const done = isDone(habit, pop.ds);
  const skipped = isSkipped(habit, pop.ds);
  const valueText = numeric(habit)
    ? (pop.v > 0 ? fmtCellValue(pop.v, habit.unit) : "not logged")
    : done ? "completed" : skipped ? "skipped" : "not logged";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }}>
      <div style={{ position: "fixed", left: Math.min(pop.rect.left, window.innerWidth - 180), top: pop.rect.bottom + 6, zIndex: 41, background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 9, padding: "8px 11px", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize: 11.5, color: HT.textPrimary, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: habit.color || HT.gold, marginTop: 2 }}>{valueText}</div>
      </div>
    </div>
  );
}

// ── Card B — best streaks ────────────────────────────────────────────────────
function StreaksCard({ habit }) {
  const streaks = useMemo(() => computeStreaks(habit), [habit]);
  const accent = habit.color || HT.gold;
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
                  <div style={{ width: `${(s.length / streaks[0].length) * 100}%`, height: "100%", background: accent, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: accent, fontFamily: "monospace", width: 34, textAlign: "right" }}>{s.length}d</span>
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
  let run = 0, runStart = null, runEnd = null;
  let guard = 0;
  while (cursor <= today && guard++ < 4000) {
    if (isScheduled(habit, cursor)) {
      if (isDone(habit, cursor)) {
        if (run === 0) runStart = cursor;
        run++; runEnd = cursor;
      } else if (!isSkipped(habit, cursor)) {
        if (run > 0) runs.push({ start: runStart, end: runEnd, length: run });
        run = 0;
      }
    }
    cursor = addDays(cursor, 1);
  }
  if (run > 0) runs.push({ start: runStart, end: runEnd, length: run });
  return runs.sort((a, b) => b.length - a.length).slice(0, 5);
}

// ── Card C — frequency ───────────────────────────────────────────────────────
function FrequencyCard({ habit }) {
  const days = Array.isArray(habit.days) ? habit.days : [];
  const accent = habit.color || HT.gold;
  return (
    <Panel>
      <span style={{ fontSize: 12, color: HT.textSecondary, letterSpacing: 0.5 }}>frequency</span>
      <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "space-between", maxWidth: 300 }}>
        {DAY_ROWS.map((d) => {
          const on = days.includes(d);
          return (
            <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: on ? accent : HT.cellEmpty, border: `1px solid ${on ? accent : HT.border}` }} />
              <span style={{ fontSize: 10, color: on ? HT.textPrimary : HT.textSecondary }}>{DAY_LETTER[d]}</span>
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

function monthSpan(startDs, endDs) {
  const a = new Date(`${startDs}T12:00:00`), b = new Date(`${endDs}T12:00:00`);
  const fmt = (d, opts) => d.toLocaleDateString("en-US", opts);
  if (a.getFullYear() === b.getFullYear()) {
    return a.getMonth() === b.getMonth()
      ? `${fmt(a, { month: "short" })} ${a.getFullYear()}`
      : `${fmt(a, { month: "short" })} – ${fmt(b, { month: "short" })} ${b.getFullYear()}`;
  }
  return `${fmt(a, { month: "short", year: "numeric" })} – ${fmt(b, { month: "short", year: "numeric" })}`;
}
const shortDate = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
