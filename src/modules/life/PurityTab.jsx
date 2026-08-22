// ── Purity & Self-Control (Life OS tab) ──────────────────────────────
// One honest daily check-in. Green days compound; a red day is data, not
// judgment — the interface stays calm and points forward. Beyond the check-in
// it answers three questions a streak counter can't: when the risk clusters
// (time-of-day window), how fast you recover after a slip, and what to reach
// for in the moment (the urge timer).
import { useMemo, useState, useEffect, useRef } from "react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ShieldCheck, ChevronLeft, ChevronRight, Undo2, Flame, Trophy, Hourglass, Clock } from "lucide-react";
import { B2, BD, BD2, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { Collapse } from "../../shared/Collapse.jsx";
import { MotivePush } from "../../shared/MotivePush.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr } from "../../shared/dates.js";
import {
  sanitizePurity, statusOn, setDay, patchDay, purityStats, relapseInsights,
  weeklyPurity, quoteForDay, recoveryStats, timeOfDayRisk, RISK_BUCKETS, MILESTONES, TRIGGERS,
} from "./purity.js";

const WD = ["S", "M", "T", "W", "T", "F", "S"];
const fmtHour = (h) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;

// ── A metric tile matching the redesign's card language ──────────────
function Metric({ label, value, unit, sub, subTone }) {
  const c = subTone === "good" ? GR : subTone === "bad" ? RE : T3;
  return (
    <div style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 12, padding: "11px 13px" }}>
      <div style={{ fontSize: 9, color: T3, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: T1, lineHeight: 1, letterSpacing: -0.3, fontFamily: "'JetBrains Mono',monospace" }}>
        {value}{unit ? <span style={{ fontSize: 11, color: T3, fontWeight: 400 }}>{unit}</span> : null}
      </div>
      {sub != null && <div style={{ fontSize: 9.5, color: c, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ── Urge timer — ten minutes to let the wave pass ────────────────────
function UrgeTimer() {
  const [uses, setUses] = useStorageState("purity_urges", []);
  const [left, setLeft] = useState(null); // seconds remaining, null = idle
  const toast = useToast();
  const tick = useRef(null);

  useEffect(() => () => clearInterval(tick.current), []);
  const start = () => {
    setUses((prev) => [...(Array.isArray(prev) ? prev : []), new Date().toISOString()].slice(-500));
    setLeft(600);
    clearInterval(tick.current);
    tick.current = setInterval(() => {
      setLeft((s) => {
        if (s == null) return s;
        if (s <= 1) { clearInterval(tick.current); toast("The wave passed. You're still here. 🌿", { tone: "success", duration: 5000 }); return null; }
        return s - 1;
      });
    }, 1000);
  };
  const stop = () => { clearInterval(tick.current); setLeft(null); };
  const running = left != null;
  const mm = String(Math.floor((left ?? 600) / 60)).padStart(2, "0");
  const ss = String((left ?? 600) % 60).padStart(2, "0");
  const count = Array.isArray(uses) ? uses.length : 0;

  return (
    <Card style={{ padding: "16px 18px", borderColor: `${AM}33` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Hourglass size={14} color={AM} />
        <span style={{ fontSize: 13, fontWeight: 600, color: T1, flex: 1 }}>Feeling an urge?</span>
        {count > 0 && <span style={{ fontSize: 10.5, color: T3 }}>used {count}×</span>}
      </div>
      <div style={{ textAlign: "center", paddingTop: 2 }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, lineHeight: 1, fontFamily: "'JetBrains Mono',monospace", color: running ? AM : T1, fontVariantNumeric: "tabular-nums" }}>{mm}:{ss}</div>
        <div style={{ fontSize: 11, color: T2, marginTop: 7, lineHeight: 1.55 }}>
          Urges peak and fade in under ten minutes.<br />Start it, put the phone down, walk.
        </div>
        <button onClick={running ? stop : start}
          style={{ marginTop: 11, width: "100%", padding: "10px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: running ? GL : `${AM}14`, border: `1px solid ${AM}${running ? "44" : "55"}`, color: running ? T2 : AM }}>
          {running ? "I made it — stop the timer" : "Start the timer"}
        </button>
      </div>
    </Card>
  );
}

/**
 * The Purity detail, opened from its pinned habit inside Discipline. Same
 * screen as before the merge — urge timer, risk window, recovery speed,
 * triggers, calendar, milestones — it just no longer lives on its own tab.
 */
export function PurityDetail({ onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back to Discipline"
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, margin: "16px 0 0 24px",
            background: "none", border: "none", color: T3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <ChevronLeft size={14} /> Discipline
        </button>
      )}
      <div style={{ flex: 1, overflowY: "auto" }}><PurityTab /></div>
    </div>
  );
}

export function PurityTab() {
  const [rawLog, setLog] = useStorageState("purity_log", {});
  const log = useMemo(() => sanitizePurity(rawLog), [rawLog]);
  const toast = useToast();
  const today = localDateStr();
  const [month, setMonth] = useState(() => today.slice(0, 7)); // "YYYY-MM"

  const stats = useMemo(() => purityStats(log, today), [log, today]);
  const insights = useMemo(() => relapseInsights(log, today), [log, today]);
  const recovery = useMemo(() => recoveryStats(log, today), [log, today]);
  const risk = useMemo(() => timeOfDayRisk(log), [log]);
  const weeks = useMemo(() => weeklyPurity(log, 12, today), [log, today]);
  const todayStatus = statusOn(log, today);
  const todayEntry = log[today];
  const tracked = Object.keys(log).length;

  const mark = (status) => {
    setLog((prev) => {
      const clean = sanitizePurity(prev);
      let next = setDay(clean, today, status);
      // Stamp the hour a relapse is logged so the risk window can learn when
      // it tends to happen — auto, so it costs no extra tap.
      if (status === "relapse") next = patchDay(next, today, { t: new Date().getHours() });
      return next;
    });
    if (status === "pure") {
      const newStreak = stats.current + (todayStatus ? 0 : 1);
      if (MILESTONES.includes(newStreak)) toast(`🏆 ${newStreak} days. This is who you are now.`, { tone: "success", duration: 6000 });
      else toast("Day held. 🌿", { tone: "success", duration: 2500 });
    } else if (status === "relapse") {
      toast("Logged. Day 0 is where every streak starts — rest, and note the trigger.", { tone: "info", duration: 5000 });
    }
  };
  const undoToday = () => setLog((prev) => setDay(sanitizePurity(prev), today, null));
  const setRelapseHour = (h) => setLog((prev) => patchDay(sanitizePurity(prev), today, { t: h }));
  const toggleTrigger = (t) => {
    setLog((prev) => {
      const clean = sanitizePurity(prev);
      const cur = clean[today]?.triggers || [];
      return patchDay(clean, today, { triggers: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
    });
  };
  const setReflection = (key, value) => setLog((prev) => patchDay(sanitizePurity(prev), today, { [key]: value }));

  const cycleDay = (ds) => {
    if (ds > today) return;
    const cur = statusOn(log, ds);
    const next = cur === null ? "pure" : cur === "pure" ? "relapse" : null;
    setLog((prev) => setDay(sanitizePurity(prev), ds, next));
  };

  // ── Month grid ──────────────────────────────────────────────────────
  const [my, mm] = month.split("-").map(Number);
  const daysInMonth = new Date(my, mm, 0).getDate();
  const firstWd = new Date(my, mm - 1, 1).getDay();
  const cells = [
    ...Array.from({ length: firstWd }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const shiftMonth = (n) => {
    const d = new Date(my, mm - 1 + n, 15);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(my, mm - 1, 15).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const nextMilestone = MILESTONES.find((m) => m > stats.current) || null;
  const triggerCounts = Object.entries(insights.byTrigger || {}).sort((a, b) => b[1] - a[1]);

  const input = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "none", lineHeight: 1.6 };
  const sectLabel = { fontSize: 9, color: T3, letterSpacing: 1.1, textTransform: "uppercase", margin: "2px 2px 0", display: "flex", alignItems: "center", gap: 6 };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 860 }}>
      <div style={{ fontSize: 11, color: T2 }}>
        {todayStatus ? "" : `Day ${stats.current + 1} unclaimed · `}{stats.totalPure} clean of {tracked} tracked
      </div>

      <MotivePush context={["purity"]} state={{ streak: stats.current, legendary: stats.current >= 90 }} accent={GR} />

      {/* ── Daily check-in ── */}
      {!todayStatus && (
        <Card style={{ padding: "22px 24px", textAlign: "center", borderColor: `${GR}22`, background: `linear-gradient(150deg,${GR}0C,transparent 70%)` }}>
          <div style={{ fontSize: 10, color: T3, letterSpacing: 2.2, textTransform: "uppercase", marginBottom: 8 }}>Daily check-in</div>
          <div style={{ fontSize: 14.5, color: T2, marginBottom: 15 }}>
            {stats.current > 0 ? `Day ${stats.current + 1} is waiting to be claimed.` : "Today is a clean page."}
          </div>
          <button onClick={() => mark("pure")}
            style={{ width: "100%", padding: "13px", background: `linear-gradient(95deg,#3B8F52,${GR})`, border: "none", borderRadius: 12, color: "#04130a", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 6px 26px ${GR}33` }}>
            <ShieldCheck size={15} style={{ verticalAlign: -2, marginRight: 7 }} />Stayed pure today
          </button>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => mark("relapse")}
              style={{ background: "none", border: "none", color: T3, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>
              Record a relapse instead
            </button>
          </div>
        </Card>
      )}

      {todayStatus === "pure" && (
        <Card key="pure" style={{ padding: "20px 22px", borderColor: `${GR}55`, background: `linear-gradient(180deg,${GR}0E,transparent)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: `${GR}1E`, border: `1px solid ${GR}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={20} color={GR} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: GR }}>Day {stats.current} held. ✓</div>
              <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, marginTop: 4, fontStyle: "italic" }}>"{quoteForDay(today)}"</div>
            </div>
            <button onClick={undoToday} aria-label="Undo today's check-in" title="Undo (miss-tap)"
              style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: T3, display: "flex" }}><Undo2 size={13} /></button>
          </div>
        </Card>
      )}

      {todayStatus === "relapse" && (
        <Card key="relapse" style={{ padding: "20px 22px", borderColor: `${RE}33` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: `${RE}12`, border: `1px solid ${RE}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌱</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: T1 }}>Day 0 — where every streak starts.</div>
              <div style={{ fontSize: 12, color: T2, lineHeight: 1.65, marginTop: 4 }}>
                No shame here. Your longest run is still {stats.longest} day{stats.longest === 1 ? "" : "s"} and that hasn't gone anywhere. Note the trigger — and roughly when — so the day still teaches something.
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 11 }}>
                {TRIGGERS.map((t) => {
                  const on = (todayEntry?.triggers || []).includes(t);
                  return (
                    <button key={t} onClick={() => toggleTrigger(t)}
                      style={{ padding: "5px 11px", borderRadius: 14, fontSize: 11, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${on ? AM + "55" : BD}`, background: on ? `${AM}16` : GL, color: on ? AM : T3 }}>
                      {t}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
                <Clock size={12} color={T3} />
                <span style={{ fontSize: 10.5, color: T3 }}>Happened around</span>
                <select value={todayEntry?.t ?? new Date().getHours()} onChange={(e) => setRelapseHour(Number(e.target.value))}
                  style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "4px 8px", fontSize: 11, color: T1, fontFamily: "inherit", cursor: "pointer" }}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
                </select>
              </div>
            </div>
            <button onClick={undoToday} aria-label="Undo today's entry" title="Undo (miss-tap)"
              style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: T3, display: "flex" }}><Undo2 size={13} /></button>
          </div>
        </Card>
      )}

      {/* ── Urge timer ── */}
      <UrgeTimer />

      {/* ── Metrics ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Metric label="Current" value={stats.current} unit="d" sub={`best ${stats.longest}d`} />
        <Metric label="Recovery"
          value={recovery.avg == null ? "—" : recovery.avg} unit={recovery.avg == null ? "" : "d"}
          sub={recovery.avg == null ? "no slips logged" : recovery.priorAvg != null && recovery.trend !== 0 ? `${recovery.trend < 0 ? "▼" : "▲"} from ${recovery.priorAvg}d` : "avg to bounce back"}
          subTone={recovery.avg == null ? null : recovery.trend < 0 ? "good" : recovery.trend > 0 ? "bad" : null} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <Metric label="30 day" value={stats.pct30 == null ? "—" : stats.pct30} unit={stats.pct30 == null ? "" : "%"} subTone={stats.pct30 >= 80 ? "good" : null} />
        <Metric label="90 day" value={stats.pct90 == null ? "—" : stats.pct90} unit={stats.pct90 == null ? "" : "%"} />
        <Metric label="Clean" value={stats.totalPure} />
      </div>

      {/* ── When it happens — time-of-day risk window ── */}
      {(risk.total >= 2 || insights.topWeekday) && (
        <>
          <div style={sectLabel}>When it happens</div>
          <Card style={{ padding: "14px 16px" }}>
            {risk.total >= 1 ? (
              <div style={{ display: "flex", gap: 3 }}>
                {risk.buckets.map((n, i) => {
                  const level = risk.max > 0 && n === risk.max ? "hi" : n >= risk.max * 0.5 && n > 0 ? "md" : "lo";
                  return (
                    <div key={i} title={`${RISK_BUCKETS[i]} · ${n} relapse${n === 1 ? "" : "s"}`}
                      style={{ flex: 1, height: 26, borderRadius: 5, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 3, fontSize: 7.5,
                        background: level === "hi" ? `${RE}4D` : level === "md" ? `${RE}22` : "#241F18",
                        color: level === "hi" ? T1 : T3 }}>{RISK_BUCKETS[i]}</div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: T3, lineHeight: 1.5 }}>Log a slip's time and the risk window fills in — it learns when the pull is strongest.</div>
            )}
            {risk.peakLabel && risk.total >= 2 && (
              <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 9, fontSize: 10.5, lineHeight: 1.5, background: `${RE}0F`, border: `1px solid ${RE}33`, color: T2 }}>
                <b style={{ color: RE }}>{risk.peakLabel}</b> · {risk.max} of {risk.total} slips cluster here.
              </div>
            )}
            {insights.topWeekday && (
              <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 9, fontSize: 10.5, lineHeight: 1.5, background: `${RE}0F`, border: `1px solid ${RE}33`, color: T2 }}>
                <b style={{ color: RE }}>{insights.topWeekday}s</b> come up most in your slips — worth a plan for the next one.
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Triggers logged ── */}
      {triggerCounts.length > 0 && (
        <>
          <div style={sectLabel}>Triggers logged</div>
          <Card style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {triggerCounts.map(([t, n], i) => (
                <span key={t} style={{ fontSize: 10.5, padding: "5px 10px", borderRadius: 14, border: `1px solid ${i < 2 ? AM + "4D" : BD}`, background: i < 2 ? `${AM}14` : GL, color: i < 2 ? AM : T2 }}>
                  {t} · {n}
                </span>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* ── Month calendar (relapse outlined, not filled) ── */}
      <Card style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: T2, display: "flex" }}><ChevronLeft size={13} /></button>
          <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: T2, display: "flex" }}><ChevronRight size={13} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
          {WD.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 9, color: T3, letterSpacing: 1 }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((ds, i) => {
            if (!ds) return <div key={`e${i}`} />;
            const s = statusOn(log, ds);
            const future = ds > today;
            const isToday = ds === today;
            return (
              <button key={ds} onClick={() => cycleDay(ds)} disabled={future}
                aria-label={`${ds}${s ? ` — ${s}` : ""}`}
                title={future ? "" : `${ds} · tap to cycle: clean → relapse → clear`}
                style={{
                  aspectRatio: "1", borderRadius: 6, cursor: future ? "default" : "pointer", fontFamily: "monospace", fontSize: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  // clean = filled green; relapse = OUTLINED red on the raised
                  // surface (a slip is a marked day, not a wall of red).
                  background: s === "pure" ? `${GR}26` : s === "relapse" ? B2 : GL,
                  border: `1px solid ${isToday ? CY + "AA" : s === "pure" ? GR + "55" : s === "relapse" ? RE + "77" : BD}`,
                  color: s === "pure" ? GR : s === "relapse" ? RE : future ? BD2 : T3,
                  opacity: future ? 0.35 : 1,
                }}>
                {+ds.slice(8)}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 10, color: T3, justifyContent: "flex-end" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: `${GR}40` }} />clean</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, border: `1px solid ${RE}88` }} />relapse</span>
        </div>
      </Card>

      {/* ── Milestones (pill format) ── */}
      <div style={sectLabel}><Trophy size={12} color={AM} /> Milestones{nextMilestone ? ` · ${nextMilestone - stats.current} to ${nextMilestone}` : ""}</div>
      <Card style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {MILESTONES.map((m) => {
            const got = stats.longest >= m;
            const isNext = m === nextMilestone;
            const toGo = m - stats.current;
            return (
              <span key={m} title={got ? `Reached — best run ${stats.longest}d` : `Reach a ${m}-day streak`}
                style={{ fontSize: 10.5, padding: "6px 11px", borderRadius: 14, fontFamily: "monospace",
                  background: got ? `${GR}14` : isNext ? `${AM}14` : GL, border: `1px solid ${got ? GR + "4D" : isNext ? AM + "55" : BD}`,
                  color: got ? GR : isNext ? AM : T3, opacity: got || isNext ? 1 : 0.55 }}>
                {m}d {got ? "✓" : isNext ? `· ${toGo} to go` : ""}
              </span>
            );
          })}
        </div>
      </Card>

      {/* ── Optional reflection ── */}
      {todayStatus && (
        <Collapse id="purity_reflect" title="Today's Reflection" sub="optional — 60 seconds" defaultOpen={todayStatus === "relapse"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea value={todayEntry?.helped || ""} onChange={(e) => setReflection("helped", e.target.value)} placeholder="What helped today?" style={{ ...input, minHeight: 44 }} />
            <textarea value={todayEntry?.trigger || ""} onChange={(e) => setReflection("trigger", e.target.value)} placeholder="Biggest temptation or trigger?" style={{ ...input, minHeight: 44 }} />
            <textarea value={todayEntry?.improve || ""} onChange={(e) => setReflection("improve", e.target.value)} placeholder="What will I improve tomorrow?" style={{ ...input, minHeight: 44 }} />
            {todayStatus === "pure" && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, color: T3, alignSelf: "center" }}>Triggers faced today:</span>
                {TRIGGERS.map((t) => {
                  const on = (todayEntry?.triggers || []).includes(t);
                  return (
                    <button key={t} onClick={() => toggleTrigger(t)}
                      style={{ padding: "4px 10px", borderRadius: 13, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${on ? AM + "55" : BD}`, background: on ? `${AM}16` : GL, color: on ? AM : T3 }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Collapse>
      )}

      {/* ── Weekly patterns chart ── */}
      {Object.keys(log).length >= 3 && (
        <Card style={{ padding: "14px 16px" }}>
          <SH title="Patterns" sub="Weekly clean % · relapses per week — last 12 weeks" action={<Flame size={13} color={GR} />} />
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={weeks} margin={{ top: 4, right: -14, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BD} />
              <XAxis dataKey="label" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis yAxisId="l" stroke={T3} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
              <YAxis yAxisId="r" orientation="right" stroke={T3} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={mkTT("")} />
              <Line yAxisId="l" type="monotone" dataKey="pct" name="clean %" stroke={GR} strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="relapses" name="relapses" stroke={RE} strokeWidth={1.5} dot={{ fill: RE, r: 2.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
