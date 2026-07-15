// ── Purity & Self-Control (Life OS tab) ──────────────────────────────
// One honest daily check-in. Green days compound; a red day is data, not
// judgment — the interface stays calm and points forward.
import { useMemo, useState } from "react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ShieldCheck, ChevronLeft, ChevronRight, Undo2, Flame, Trophy } from "lucide-react";
import { B2, BD, BD2, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip, Meter } from "../../shared/ui.jsx";
import { Collapse } from "../../shared/Collapse.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr } from "../../shared/dates.js";
import {
  sanitizePurity, statusOn, setDay, patchDay, purityStats, relapseInsights,
  weeklyPurity, quoteForDay, MILESTONES, TRIGGERS,
} from "./purity.js";

const WD = ["S", "M", "T", "W", "T", "F", "S"];

export function PurityTab() {
  const [rawLog, setLog] = useStorageState("purity_log", {});
  const log = useMemo(() => sanitizePurity(rawLog), [rawLog]);
  const toast = useToast();
  const today = localDateStr();
  const [month, setMonth] = useState(() => today.slice(0, 7)); // "YYYY-MM"

  const stats = useMemo(() => purityStats(log, today), [log, today]);
  const insights = useMemo(() => relapseInsights(log, today), [log, today]);
  const weeks = useMemo(() => weeklyPurity(log, 12, today), [log, today]);
  const todayStatus = statusOn(log, today);
  const todayEntry = log[today];

  const mark = (status) => {
    setLog((prev) => setDay(sanitizePurity(prev), today, status));
    if (status === "pure") {
      const newStreak = stats.current + (todayStatus ? 0 : 1);
      if (MILESTONES.includes(newStreak)) {
        toast(`🏆 ${newStreak} days. This is who you are now.`, { tone: "success", duration: 6000 });
      } else {
        toast("Day held. 🌿", { tone: "success", duration: 2500 });
      }
    } else if (status === "relapse") {
      toast("Logged. Day 0 is where every streak starts — rest, and note the trigger.", { tone: "info", duration: 5000 });
    }
  };
  const undoToday = () => setLog((prev) => setDay(sanitizePurity(prev), today, null));
  const toggleTrigger = (t) => {
    setLog((prev) => {
      const clean = sanitizePurity(prev);
      const cur = clean[today]?.triggers || [];
      return patchDay(clean, today, { triggers: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
    });
  };
  const setReflection = (key, value) => setLog((prev) => patchDay(sanitizePurity(prev), today, { [key]: value }));

  // Backfill/correct past days: click cycles pure → relapse → unlogged.
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
  const prevMilestone = [...MILESTONES].reverse().find((m) => m <= stats.current) || 0;
  const mProgress = nextMilestone
    ? Math.round(((stats.current - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;

  const input = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "none", lineHeight: 1.6 };

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
      {/* ── Daily check-in ── */}
      {!todayStatus && (
        <Card style={{ padding: "24px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T3, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6 }}>Daily check-in</div>
          <div style={{ fontSize: 15, color: T2, marginBottom: 16 }}>
            {stats.current > 0 ? `Day ${stats.current + 1} is waiting to be claimed.` : "Today is a clean page."}
          </div>
          <button onClick={() => mark("pure")}
            style={{ padding: "13px 34px", background: `linear-gradient(135deg,${GR},#5fae7c)`, border: "none", borderRadius: 12, color: "#04130a", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 6px 26px ${GR}33` }}>
            <ShieldCheck size={15} style={{ verticalAlign: -2, marginRight: 7 }} />Stayed Pure Today
          </button>
          <div style={{ marginTop: 13 }}>
            <button onClick={() => mark("relapse")}
              style={{ background: "none", border: "none", color: T3, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>
              Record a relapse instead
            </button>
          </div>
        </Card>
      )}

      {todayStatus === "pure" && (
        <Card key="pure" style={{ padding: "22px 24px", borderColor: `${GR}55`, background: `linear-gradient(180deg,${GR}0E,transparent)`, animation: "purityGlow 1.6s ease" }}>
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
        <Card key="relapse" style={{ padding: "22px 24px", borderColor: `${RE}33` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: `${RE}12`, border: `1px solid ${RE}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌱</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: T1 }}>Day 0 — where every streak starts.</div>
              <div style={{ fontSize: 12, color: T2, lineHeight: 1.65, marginTop: 4 }}>
                No shame here. Your longest run is still {stats.longest} day{stats.longest === 1 ? "" : "s"} and that hasn't gone anywhere. Note the trigger below — that's how this day still counts for something.
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
            </div>
            <button onClick={undoToday} aria-label="Undo today's entry" title="Undo (miss-tap)"
              style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: T3, display: "flex" }}><Undo2 size={13} /></button>
          </div>
        </Card>
      )}

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        <Chip label="Current streak" value={`${stats.current}d`} color={GR} />
        <Chip label="Longest" value={`${stats.longest}d`} color={AM} />
        <Chip label="Clean days" value={stats.totalPure} color={CY} />
        <Chip label="30d" value={stats.pct30 == null ? "—" : `${stats.pct30}%`} color={GR} />
        <Chip label="90d" value={stats.pct90 == null ? "—" : `${stats.pct90}%`} color={PU} />
        <Chip label="365d" value={stats.pct365 == null ? "—" : `${stats.pct365}%`} color={T2} />
      </div>

      {/* ── Milestones ── */}
      <Card style={{ padding: "16px 18px" }}>
        <SH title="Milestones" sub={nextMilestone ? `${nextMilestone - stats.current} day${nextMilestone - stats.current === 1 ? "" : "s"} to ${nextMilestone}` : "Every milestone earned"} action={<Trophy size={13} color={AM} />} />
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
          {MILESTONES.map((m) => {
            const got = stats.longest >= m;
            const isNext = m === nextMilestone;
            return (
              <div key={m} title={got ? `Reached — best run ${stats.longest}d` : `Reach a ${m}-day streak`}
                style={{ padding: "7px 13px", borderRadius: 11, textAlign: "center", background: got ? `${AM}14` : GL, border: `1px solid ${got ? AM + "55" : isNext ? GR + "44" : BD}`, opacity: got || isNext ? 1 : 0.5 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: got ? AM : isNext ? GR : T3, fontFamily: "monospace" }}>{m}</div>
                <div style={{ fontSize: 8.5, color: T3, letterSpacing: 1 }}>DAYS</div>
              </div>
            );
          })}
        </div>
        {nextMilestone && (
          <Meter pct={mProgress} fill={`linear-gradient(90deg,${GR}77,${GR})`} />
        )}
      </Card>

      {/* ── Month calendar ── */}
      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: T2, display: "flex" }}><ChevronLeft size={13} /></button>
          <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{monthLabel}</span>
          <button onClick={() => shiftMonth(1)} aria-label="Next month" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: T2, display: "flex" }}><ChevronRight size={13} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 6 }}>
          {WD.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 9, color: T3, letterSpacing: 1 }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
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
                  aspectRatio: "1", borderRadius: 8, cursor: future ? "default" : "pointer", fontFamily: "monospace", fontSize: 10.5,
                  background: s === "pure" ? `${GR}26` : s === "relapse" ? `${RE}14` : GL,
                  border: `1px solid ${isToday ? CY + "88" : s === "pure" ? GR + "55" : s === "relapse" ? RE + "44" : BD}`,
                  color: s === "pure" ? GR : s === "relapse" ? RE : future ? BD2 : T3,
                  opacity: future ? 0.4 : 1,
                }}>
                {+ds.slice(8)}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 11, fontSize: 10, color: T3, justifyContent: "flex-end" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: `${GR}26`, border: `1px solid ${GR}55` }} />clean</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: `${RE}14`, border: `1px solid ${RE}44` }} />relapse</span>
        </div>
      </Card>

      {/* ── Optional reflection ── */}
      {todayStatus && (
        <Collapse id="purity_reflect" title="Today's Reflection" sub="optional — 60 seconds" defaultOpen={todayStatus === "relapse"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea value={todayEntry?.helped || ""} onChange={(e) => setReflection("helped", e.target.value)}
              placeholder="What helped today?" style={{ ...input, minHeight: 44 }} />
            <textarea value={todayEntry?.trigger || ""} onChange={(e) => setReflection("trigger", e.target.value)}
              placeholder="Biggest temptation or trigger?" style={{ ...input, minHeight: 44 }} />
            <textarea value={todayEntry?.improve || ""} onChange={(e) => setReflection("improve", e.target.value)}
              placeholder="What will I improve tomorrow?" style={{ ...input, minHeight: 44 }} />
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

      {/* ── Insights ── */}
      {Object.keys(log).length >= 3 && (
        <Card style={{ padding: "16px 18px" }}>
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
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 11.5, color: T2 }}>
            <span>Relapses last 30d: <span style={{ color: insights.last30 ? RE : GR, fontWeight: 700 }}>{insights.last30}</span></span>
            {insights.topTrigger && <span>Most common trigger: <span style={{ color: AM, fontWeight: 700 }}>{insights.topTrigger[0]}</span> ({insights.topTrigger[1]}×)</span>}
            {insights.topWeekday && <span>Watch out on: <span style={{ color: AM, fontWeight: 700 }}>{insights.topWeekday}s</span></span>}
          </div>
        </Card>
      )}
    </div>
  );
}
