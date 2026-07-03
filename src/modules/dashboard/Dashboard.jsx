import { useState, useEffect } from "react";
import { Cpu, CheckCircle, Check, Flame, Activity as ActivityIcon } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, GR, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip } from "../../shared/ui.jsx";
import { getActiveKillzone, getEATTimeStr } from "../trading/timezone.js";
import { useStorageState } from "../../shared/useStorageState.js";
import { DonutChart, ChartLegend, ActivityHeatmap } from "../../shared/charts.jsx";
import { nextSmallAction, nudgeOfTheDay, compound } from "../../shared/kaizen.js";
import { DOMAINS } from "./domains.js";
import { LifeMatrix } from "./LifeMatrix.jsx";

export function Dashboard({ onNavigate, habits, setHabits }) {
  const [kz, setKz] = useState(getActiveKillzone);
  const [eatTime, setEatTime] = useState(getEATTimeStr);
  const [trades] = useStorageState("ict_trades", []);
  const [workouts] = useStorageState("athlete_workouts", []);

  useEffect(() => {
    const t = setInterval(() => { setKz(getActiveKillzone()); setEatTime(getEATTimeStr()); }, 30000);
    return () => clearInterval(t);
  }, []);

  const done = habits.filter((h) => h.done).length;

  // Domain balance donut
  const domainPie = DOMAINS.map((d) => ({ name: d.label, value: d.score, color: d.color }));

  // Activity heatmap: any day with a logged trade or workout counts.
  const activityCounts = {};
  trades.forEach((t) => { if (t.date) activityCounts[t.date] = (activityCounts[t.date] || 0) + 1; });
  workouts.forEach((w) => { if (w.date) activityCounts[w.date] = (activityCounts[w.date] || 0) + 1; });
  const activeDays = Object.keys(activityCounts).length;
  const totalActivity = Object.values(activityCounts).reduce((s, c) => s + c, 0);

  // Kaizen — the single smallest action that moves today forward.
  const action = nextSmallAction({ habits, workouts, trades });
  const nudge = nudgeOfTheDay();
  const yearMultiple = compound(365).toFixed(0);

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ padding: "10px 18px", background: `${kz.color}11`, border: `1px solid ${kz.color}33`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: kz.active ? kz.color : T3, boxShadow: kz.active ? `0 0 10px ${kz.color}` : undefined }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: kz.color, letterSpacing: 1 }}>{kz.label.toUpperCase()}</span>
          {kz.active && <span style={{ fontSize: 11, color: T3 }}>Active now (Nairobi)</span>}
        </div>
        <span style={{ fontSize: 11, color: T3 }}>{eatTime} EAT</span>
      </div>

      <Card style={{ padding: "20px 24px", borderColor: `${GR}33`, background: `linear-gradient(180deg,${GR}0C,transparent)` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 30, lineHeight: 1 }}>{action.icon}</div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 3, color: GR, textTransform: "uppercase", marginBottom: 5, fontWeight: 700 }}>Today's 1% · {action.area}</div>
              <div style={{ fontSize: 15, color: T1, fontWeight: 600, lineHeight: 1.5, maxWidth: 620 }}>{action.text}</div>
              <div style={{ fontSize: 11.5, color: T3, marginTop: 6 }}>{nudge}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: GR, fontFamily: "'JetBrains Mono',monospace" }}>{yearMultiple}×</div>
            <div style={{ fontSize: 10, color: T3, lineHeight: 1.4, maxWidth: 150 }}>1% better daily compounds to ~{yearMultiple}× over a year</div>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <Card style={{ padding: "24px 24px 24px 20px", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: T3, letterSpacing: 3, marginBottom: 18, textTransform: "uppercase" }}>Life Matrix</div>
          <LifeMatrix size={220} />
        </Card>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 13, minWidth: 0 }}>
          <Card style={{ padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
              <div style={{ width: 27, height: 27, borderRadius: 8, background: `${CY}22`, border: `1px solid ${CY}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Cpu size={13} color={CY} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: CY, letterSpacing: 2.5 }}>ARCHITECT DAILY BRIEF</div>
                <div style={{ fontSize: 10, color: T3 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
              </div>
            </div>
            {[
              { i: "📊", t: "NY Open opens at 2:00 PM EAT. 9:50 NY Macro (4:50 PM EAT) — prime A+ entry window. DOL: watch PDH at 21,540 as BSL target." },
              { i: "💪", t: "Upper Strength today (W6). HRV 74ms — full intensity cleared. Strength BEFORE any cardio if same session." },
              { i: "⚠️", t: "Zone 2 missed 2 consecutive days. Prioritise 60-min Zone 2 tomorrow morning (130–145 BPM)." },
              { i: "💰", t: "June budget: leisure $60 over. Redirect to emergency fund. On track for 50% target by July 31." },
            ].map((x, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 11px", background: GL, borderRadius: 9, border: `1px solid ${BD}`, marginBottom: 7 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{x.i}</span>
                <span style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{x.t}</span>
              </div>
            ))}
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Chip label="FundedNext Balance" value="$15,000" color={GR} />
            <Chip label="Zone 2 This Week"   value="2 / 3"   color={kz.color} />
            <Chip label="Recovery / HRV"      value="74 ms"   color={AM} />
            <Chip label="Top Habit Streak"    value="15 days"  color={CY} />
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: T3, letterSpacing: 3, marginBottom: 11, textTransform: "uppercase" }}>Domain Performance</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 11 }}>
          {DOMAINS.map(({ key, label, color, score }) => (
            <Card
              key={key} style={{ padding: "13px", cursor: "pointer", transition: "border-color 0.2s" }}
              onClick={() => onNavigate(key === "social" ? "relations" : key)}
            >
              <div style={{ fontSize: 9, color: T3, letterSpacing: 2, marginBottom: 7, textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{score}</div>
              <div style={{ height: 3, background: BD, borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${score}%`, background: `linear-gradient(90deg,${color}55,${color})`, borderRadius: 2 }} />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 20 }}>
        <Card style={{ padding: "18px" }}>
          <SH title="Domain Balance" sub="Relative weight across all 6 domains" />
          <DonutChart data={domainPie} height={200} centerLabel={Math.round(DOMAINS.reduce((s, d) => s + d.score, 0) / DOMAINS.length)} centerSub="Life Score" />
          <ChartLegend data={domainPie} fmt={(v) => String(v)} />
        </Card>

        <Card style={{ padding: "18px" }}>
          <SH title="Activity Consistency" sub="Trades + workouts logged — last 13 weeks" action={
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T2 }}><ActivityIcon size={11} color={CY} />{activeDays} active days</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T2 }}><Flame size={11} color={AM} />{totalActivity} sessions</span>
            </div>
          } />
          <ActivityHeatmap counts={activityCounts} weeks={13} color={CY} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 12, fontSize: 9.5, color: T3 }}>
            Less
            <div style={{ width: 11, height: 11, borderRadius: 3, background: BD }} />
            <div style={{ width: 11, height: 11, borderRadius: 3, background: `${CY}55` }} />
            <div style={{ width: 11, height: 11, borderRadius: 3, background: `${CY}99` }} />
            <div style={{ width: 11, height: 11, borderRadius: 3, background: CY }} />
            More
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card style={{ padding: "18px" }}>
          <SH title="Today's Habits" sub={`${done}/${habits.length} complete`} action={
            <div style={{ display: "flex", gap: 3 }}>
              {habits.map((_, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < done ? GR : "rgba(255,255,255,0.15)" }} />)}
            </div>
          } />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {habits.map((h, i) => (
              <div key={h.name} onClick={() => setHabits((p) => p.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 25, height: 25, borderRadius: 7, background: h.done ? `${GR}22` : GL, border: `1px solid ${h.done ? GR + "44" : BD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                  {h.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: h.done ? T1 : T2, fontWeight: h.done ? 600 : 400 }}>{h.name}</div>
                  <div style={{ fontSize: 10, color: T3 }}>🔥 {h.streak} day streak</div>
                </div>
                {h.done ? <CheckCircle size={14} color={GR} /> : <div style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.15)" }} />}
              </div>
            ))}
          </div>
        </Card>

        <Card style={{ padding: "18px" }}>
          <SH title="Today's Priorities" sub="Most Important Tasks" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { t: "NQ1! 4:50 PM Macro Pre-Analysis (EAT)",  d: "TRADING", done: true,  u: false },
              { t: "Upper Body Strength (Bench 4×5 @ 80%)",   d: "ATHLETE", done: false, u: true },
              { t: "Zone 2 Makeup Session (60 min)",          d: "ATHLETE", done: false, u: true },
              { t: "Post-Session Trade Review",                d: "TRADING", done: true,  u: false },
              { t: "Evening Journal + Reflection",             d: "LIFE",    done: false, u: false },
            ].map((x, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, opacity: x.done ? 0.45 : 1 }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: x.done ? `${GR}22` : GL, border: `1.5px solid ${x.done ? GR : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {x.done && <Check size={10} color={GR} />}
                </div>
                <span style={{ flex: 1, fontSize: 12.5, color: T1, textDecoration: x.done ? "line-through" : "none" }}>{x.t}</span>
                <span style={{ fontSize: 9, letterSpacing: 0.8, padding: "2px 6px", borderRadius: 10, background: x.u ? `${AM}22` : GL, color: x.u ? AM : T3, border: `1px solid ${x.u ? AM + "44" : BD}`, whiteSpace: "nowrap" }}>
                  {x.d}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
