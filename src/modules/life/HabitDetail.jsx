// ── Screen 2 · Habit Detail (Loop layout, gold tokens) ───────────────────
// One vertical scroll, no tabs/accordion — Loop stacks every card visible:
// Header, Overview, Score trend, History (this file), then Calendar, Best
// streaks, Frequency (HabitCalendar). Score colours run through the shared
// getScoreColor rule; the trend line and history bars are accent-gold. Every
// number is live from habitEngine — God Mode is a whole-day score, never
// per-habit, so per-habit stats come from rangeStats-style windows here.
import { useState } from "react";
import { ChevronLeft, Pencil, MoreVertical, Flame, Trophy, Copy, Pause, Play, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { currentStreak, longestStreak, isScheduled, isDone, valueOn, totalCompletions } from "../../shared/habitEngine.js";
import { daysAgoStr, localDateStr } from "../../shared/dates.js";
import { HT, getScoreColor, frequencyLabel, fmtCellValue } from "./habitTheme.js";
import { HabitCalendar } from "./HabitCalendar.jsx";

// Period toggles persist per habit per session (spec §4) — a plain module map.
const PERIOD_MEM = new Map();
const memGet = (id, card, d) => PERIOD_MEM.get(`${id}:${card}`) ?? d;
const memSet = (id, card, v) => PERIOD_MEM.set(`${id}:${card}`, v);

const PERIOD_LEN = { week: 7, month: 30, year: 365 };
const numeric = (h) => (h.target || 1) > 1;

// Completion over a trailing window; isScheduled excludes pre-creation and
// unscheduled days.
function windowStat(h, fromDaysAgo, len) {
  let sched = 0, done = 0;
  for (let i = fromDaysAgo; i < fromDaysAgo + len; i++) {
    const ds = daysAgoStr(i);
    if (!isScheduled(h, ds)) continue;
    sched++;
    if (isDone(h, ds)) done++;
  }
  return { sched, done, pct: sched ? Math.round((done / sched) * 100) : 0 };
}

const subtitleOf = (h) => (h.notes || "").trim() || `${h.name} · ${frequencyLabel(h)}`;

export function HabitDetail({ habit, onBack, onEdit, onDuplicate, onTogglePause, onToggleArchive, onDelete }) {
  const [menu, setMenu] = useState(false);
  const cur = currentStreak(habit);
  const best = longestStreak(habit);

  return (
    <div style={{ padding: "16px 16px 44px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 640, margin: "0 auto" }}>
      {/* Card A — header */}
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} aria-label="Back" style={iconBtn}><ChevronLeft size={20} /></button>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${HT.gold}1A`, border: `1px solid ${HT.gold}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{habit.icon}</div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 500, color: HT.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{habit.name}</div>
          <button onClick={() => onEdit(habit)} aria-label="Edit" style={iconBtn}><Pencil size={16} /></button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenu((o) => !o)} aria-label="More" style={iconBtn}><MoreVertical size={17} /></button>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 21, width: 168, background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 11, boxShadow: "0 14px 40px rgba(0,0,0,0.5)", padding: 6 }}>
                  {[
                    { icon: <Copy size={14} />, label: "Duplicate", fn: () => onDuplicate(habit), color: HT.textPrimary },
                    { icon: habit.paused ? <Play size={14} /> : <Pause size={14} />, label: habit.paused ? "Resume" : "Pause", fn: () => onTogglePause(habit), color: HT.textPrimary },
                    { icon: habit.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />, label: habit.archived ? "Restore" : "Archive", fn: () => onToggleArchive(habit), color: HT.textPrimary },
                    { icon: <Trash2 size={14} />, label: "Delete", fn: () => { onDelete(habit); onBack(); }, color: HT.red },
                  ].map((it) => (
                    <button key={it.label} onClick={() => { setMenu(false); it.fn(); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent", color: it.color, fontSize: 13, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                      {it.icon}{it.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: HT.textSecondary, lineHeight: 1.5, margin: "10px 0 12px", paddingLeft: 2 }}>{subtitleOf(habit)}</div>

        <div style={{ display: "flex", gap: 18, paddingLeft: 2, flexWrap: "wrap", alignItems: "center" }}>
          <Meta label={frequencyLabel(habit)} />
          <Meta icon={<Flame size={13} color={HT.gold} />} value={`${cur}d`} label="streak" />
          <Meta icon={<Trophy size={13} color={HT.gold} />} value={`${best}d`} label="best" />
        </div>
      </Panel>

      {/* Cards B–D, then Screen 3 (calendar/streaks/frequency) — one scroll */}
      <OverviewCard habit={habit} />
      <TrendCard habit={habit} />
      <HistoryCard habit={habit} />
      <HabitCalendar habit={habit} />
    </div>
  );
}

// ── Card B — Overview ────────────────────────────────────────────────────────
function OverviewCard({ habit }) {
  const [period, setPeriod] = useState(() => memGet(habit.id, "overview", "month"));
  const set = (p) => { memSet(habit.id, "overview", p); setPeriod(p); };
  const score = windowStat(habit, 0, PERIOD_LEN[period]).pct;
  const color = getScoreColor(score);

  const monthDelta = windowStat(habit, 0, 30).pct - windowStat(habit, 30, 30).pct;
  const yearDelta = windowStat(habit, 0, 365).pct - windowStat(habit, 365, 365).pct;
  const allTime = totalCompletions(habit);

  return (
    <Panel>
      <CardHead label="overview" period={period} onPeriod={set} periods={["week", "month", "year"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 6 }}>
        <ScoreRing pct={score} color={color} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <Delta label="this month" value={monthDelta} suffix="%" />
          <Delta label="this year" value={yearDelta} suffix="%" />
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11.5, color: HT.textSecondary }}>all-time</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: HT.textPrimary, fontFamily: "monospace" }}>{allTime.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ── Card C — Score trend ─────────────────────────────────────────────────────
function TrendCard({ habit }) {
  const [period, setPeriod] = useState(() => memGet(habit.id, "trend", "month"));
  const set = (p) => { memSet(habit.id, "trend", p); setPeriod(p); };
  const points = trendBuckets(habit, period);
  const withData = points.filter((p) => p.has);

  return (
    <Panel>
      <CardHead label="score trend" period={period} onPeriod={set} periods={["week", "month", "year"]} />
      {withData.length < 2 ? (
        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: HT.textSecondary, fontSize: 12.5 }}>not enough data yet</div>
      ) : (
        <TrendLine points={points} />
      )}
    </Panel>
  );
}

function trendBuckets(habit, period) {
  if (period === "week") {
    return Array.from({ length: 7 }, (_, k) => {
      const i = 6 - k;
      const w = windowStat(habit, i, 7);
      return { label: weekdayLabel(daysAgoStr(i)), pct: w.pct, has: w.sched > 0 };
    });
  }
  if (period === "month") {
    return Array.from({ length: 5 }, (_, k) => {
      const w = 4 - k;
      const s = windowStat(habit, w * 7, 7);
      return { label: w === 0 ? "now" : `-${w}w`, pct: s.pct, has: s.sched > 0 };
    });
  }
  return Array.from({ length: 12 }, (_, k) => {
    const m = 11 - k;
    const s = windowStat(habit, m * 30, 30);
    return { label: `${m}`, pct: s.pct, has: s.sched > 0 };
  });
}

function TrendLine({ points }) {
  const n = points.length;
  const W = 100, H = 100;
  const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (pct) => H - (pct / 100) * H;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.pct).toFixed(2)}`).join(" ");
  const last = points[n - 1];
  return (
    <div style={{ marginTop: 6 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 120, overflow: "visible" }}>
        <path d={path} fill="none" stroke={HT.gold} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(last.pct)} r={3} fill={HT.gold} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 9.5, color: HT.textSecondary }}>{points[0].label}</span>
        <span style={{ fontSize: 9.5, color: HT.textSecondary }}>{last.label}</span>
      </div>
    </div>
  );
}

// ── Card D — History ─────────────────────────────────────────────────────────
function HistoryCard({ habit }) {
  const [period, setPeriod] = useState(() => memGet(habit.id, "history", "week"));
  const set = (p) => { memSet(habit.id, "history", p); setPeriod(p); };
  const bars = historyBars(habit, period);
  const any = bars.some((b) => b.height > 0);

  return (
    <Panel>
      <CardHead label="history" period={period} onPeriod={set} periods={["week", "month"]} />
      {!any ? (
        <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", color: HT.textSecondary, fontSize: 12.5 }}>nothing logged yet</div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 118, marginTop: 8 }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4, height: "100%" }}>
              {b.label && <span style={{ fontSize: 9, color: HT.gold, fontFamily: "monospace" }}>{b.label}</span>}
              <div style={{ width: "100%", maxWidth: 26, height: `${Math.max(3, b.height)}%`, background: b.met ? HT.gold : HT.cellEmpty, borderRadius: 4 }} />
              <span style={{ fontSize: 9, color: HT.textSecondary }}>{b.axis}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function historyBars(habit, period) {
  if (period === "week") {
    return Array.from({ length: 7 }, (_, k) => {
      const i = 6 - k;
      const ds = daysAgoStr(i);
      const scheduled = isScheduled(habit, ds);
      const met = isDone(habit, ds);
      const v = valueOn(habit, ds);
      return { met, height: met ? 100 : scheduled ? 22 : 0, label: met ? (numeric(habit) ? fmtCellValue(v, habit.unit) : "✓") : "", axis: weekdayLabel(ds)[0] };
    });
  }
  return Array.from({ length: 5 }, (_, k) => {
    const w = 4 - k;
    const s = windowStat(habit, w * 7, 7);
    return { met: s.pct >= 70, height: s.sched ? s.pct : 0, label: s.sched ? `${s.pct}%` : "", axis: w === 0 ? "now" : `-${w}w` };
  });
}

// ── shared bits ──────────────────────────────────────────────────────────────
const iconBtn = { background: "transparent", border: "none", color: HT.textSecondary, cursor: "pointer", display: "flex", padding: 4 };
const Panel = ({ children }) => (
  <div style={{ background: HT.bgCard, border: `1px solid ${HT.border}`, borderRadius: 12, padding: "14px 16px" }}>{children}</div>
);

function CardHead({ label, period, onPeriod, periods }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: HT.textSecondary, letterSpacing: 0.5 }}>{label}</span>
      <Segment options={periods.map((p) => [p, p[0].toUpperCase() + p.slice(1)])} value={period} onChange={onPeriod} />
    </div>
  );
}

function Segment({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 2, background: HT.bgPage, border: `1px solid ${HT.border}`, borderRadius: 8, padding: 2 }}>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: value === v ? 700 : 500,
            background: value === v ? `${HT.gold}22` : "transparent", color: value === v ? HT.gold : HT.textSecondary }}>{l}</button>
      ))}
    </div>
  );
}

function ScoreRing({ pct, color }) {
  const size = 78, stroke = 7, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={HT.border} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 17, fontWeight: 500, color: HT.textPrimary, fontFamily: "monospace" }}>{pct}%</span>
        <span style={{ fontSize: 9, color: HT.textSecondary }}>score</span>
      </div>
    </div>
  );
}

function Delta({ label, value, suffix = "" }) {
  const color = value > 0 ? HT.green : value < 0 ? HT.red : HT.textSecondary;
  const sign = value > 0 ? "+" : "";
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <span style={{ fontSize: 11.5, color: HT.textSecondary }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "monospace" }}>{sign}{value}{suffix}</span>
    </div>
  );
}

function Meta({ icon, value, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {icon}
      {value && <span style={{ fontSize: 13, fontWeight: 600, color: HT.textPrimary, fontFamily: "monospace" }}>{value}</span>}
      <span style={{ fontSize: 11.5, color: HT.textSecondary }}>{label}</span>
    </div>
  );
}

function weekdayLabel(ds) {
  return new Date(`${ds}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}
