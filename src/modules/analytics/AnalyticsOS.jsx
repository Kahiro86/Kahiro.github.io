// ── Analytics OS (Kaizen phase 9) ────────────────────────────────────
// One place where every OS reports in: period reports with honest deltas
// vs the previous window, and the correlations that actually change
// behaviour. Trends over isolated numbers.
import { useMemo, useState } from "react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, GitCompareArrows, Trophy } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip, Meter } from "../../shared/ui.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";
import { periodReport, weeklySeries, pearson, rVerdict, checklistVsPnl } from "../../shared/analytics.js";
import { useXp } from "../../shared/useXp.js";
import { CAT_LABEL } from "../../shared/xpEngine.js";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";

const AN = "#8B7CA0"; // muted purple — this module's accent
const PERIODS = [
  { id: 7,   l: "Week" },
  { id: 30,  l: "Month" },
  { id: 90,  l: "Quarter" },
  { id: 365, l: "Year" },
];

function Delta({ cur, prev, goodWhenUp = true, fmt = (v) => v }) {
  if (cur == null) return <span style={{ fontSize: 10.5, color: T3 }}>no data</span>;
  if (prev == null || prev === 0) return <span style={{ fontSize: 10.5, color: T3 }}>new</span>;
  const d = cur - prev;
  if (d === 0) return <span style={{ fontSize: 10.5, color: T3 }}>· steady</span>;
  const good = goodWhenUp ? d > 0 : d < 0;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: good ? GR : RE }}>
      {d > 0 ? "▲" : "▼"} {fmt(Math.abs(d))} vs prior
    </span>
  );
}

function Metric({ label, value, cur, prev, color = AN, goodWhenUp = true, fmt = (v) => v }) {
  return (
    <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 11, padding: "12px 14px" }}>
      <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, fontFamily: "monospace", marginBottom: 4 }}>{value}</div>
      <Delta cur={cur} prev={prev} goodWhenUp={goodWhenUp} fmt={fmt} />
    </div>
  );
}

export function AnalyticsOS({ habits, onNavigate }) {
  const [tab, setTab] = useState("reports");
  const [days, setDays] = useState(30);
  const [trades] = useStorageState("ict_trades", []);
  const [reviews] = useStorageState("ict_reviews", []);
  const [workouts] = useStorageState("athlete_workouts", []);
  const [finance] = useStorageState("finance_state", DEFAULT_FINANCE_STATE);
  const [entries] = useStorageState("journal_entries", []);
  const [church] = useStorageState("faith_church", []);
  const [nutrition] = useStorageState("nutrition_log", {});
  const [library] = useStorageState("mind_library", []);
  const [decisions] = useStorageState("mind_decisions", []);
  const xp = useXp();

  const deps = useMemo(() => ({
    habits: Array.isArray(habits) ? habits : [],
    trades: (Array.isArray(trades) ? trades : []).filter((t) => t && t.id),
    reviews,
    workouts: (Array.isArray(workouts) ? workouts : []).filter((w) => w && w.id),
    entries: (Array.isArray(entries) ? entries : []).filter((e) => e && e.id),
    income: Array.isArray(finance?.income) ? finance.income.filter((e) => e) : [],
    church: Array.isArray(church) ? church : [],
    library: (Array.isArray(library) ? library : []).filter((b) => b && b.id),
    decisions: (Array.isArray(decisions) ? decisions : []).filter((d) => d && d.id),
    nutrition,
  }), [habits, trades, reviews, workouts, entries, finance, church, library, decisions, nutrition]);

  const report = useMemo(() => periodReport(deps, days), [deps, days]);
  const weeks = useMemo(() => weeklySeries(deps, 10), [deps]);
  const edge = useMemo(() => checklistVsPnl(deps.trades), [deps.trades]);

  const { cur, prev } = report;
  const usd = (n) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString()}`;
  const kes = (n) => `KES ${Math.round(n).toLocaleString()}`;
  const periodName = PERIODS.find((p) => p.id === days)?.l.toLowerCase();

  const rSleep = pearson(weeks.map((w) => [w.sleepAvg, w.habitPct]));
  const rTrain = pearson(weeks.map((w) => [w.sessions, w.habitPct]));
  const rFaith = pearson(weeks.map((w) => [w.spiritualPct, w.journal]));

  const CorrCard = ({ title, sub, barKey, barName, barColor, lineKey, lineName, r }) => (
    <Card style={{ padding: "18px" }}>
      <SH title={title} sub={sub} />
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={weeks} margin={{ top: 4, right: -14, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BD} />
          <XAxis dataKey="label" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
          <YAxis yAxisId="l" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
          <YAxis yAxisId="r" orientation="right" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip content={mkTT("")} />
          <Line yAxisId="l" type="monotone" dataKey={barKey} name={barName} stroke={barColor} strokeWidth={2} dot={false} connectNulls />
          <Line yAxisId="r" type="monotone" dataKey={lineKey} name={lineName} stroke={GR} strokeWidth={2} dot={{ fill: GR, r: 2.5 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.55, marginTop: 8, padding: "8px 11px", background: GL, borderRadius: 9, border: `1px solid ${BD}` }}>
        {rVerdict(r)}
      </div>
    </Card>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tint="rgba(8,7,12,0.5)" activeBg={`${AN}26`} activeColor="#B4A6C8"
        tabs={[{ id: "reports", l: "Reports", i: BarChart3 }, { id: "trends", l: "Trends", i: GitCompareArrows }, { id: "xp", l: "Progression", i: Trophy }]}
        active={tab} onSelect={setTab}>
        <div style={{ flex: 1 }} />
        {tab === "reports" && (
          <div style={{ display: "flex", gap: 3, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: 3 }}>
            {PERIODS.map((p) => (
              <button key={p.id} onClick={() => setDays(p.id)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: days === p.id ? `${AN}26` : "transparent", color: days === p.id ? "#B4A6C8" : T2, fontSize: 12, fontWeight: days === p.id ? 600 : 400, fontFamily: "inherit" }}>
                {p.l}
              </button>
            ))}
          </div>
        )}
      </ModuleTabs>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "reports" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 980 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>The {periodName} in review</div>
              <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>Every OS reports in — each number vs the {periodName} before it.</div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: GR, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Life</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <Metric label="Habit consistency" value={cur.habitPct == null ? "—" : `${cur.habitPct}%`} cur={cur.habitPct} prev={prev.habitPct} color={GR} fmt={(v) => `${v}pt`} />
                <Metric label="Perfect days" value={cur.perfect} cur={cur.perfect} prev={prev.perfect} color={PU} />
                <Metric label="Journal entries" value={cur.journal} cur={cur.journal} prev={prev.journal} color={CY} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: CY, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Trading</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <Metric label="Closed trades" value={cur.trades} cur={cur.trades} prev={prev.trades} color={CY} />
                <Metric label="Win rate" value={cur.wr == null ? "—" : `${cur.wr}%`} cur={cur.wr} prev={prev.wr} color={CY} fmt={(v) => `${v}pt`} />
                <Metric label="P&L" value={cur.trades ? usd(cur.pnl) : "—"} cur={cur.trades ? cur.pnl : null} prev={prev.trades ? prev.pnl : null} color={cur.pnl >= 0 ? GR : RE} fmt={(v) => `$${Math.round(v).toLocaleString()}`} />
                <Metric label="Checklist adherence" value={cur.adherence == null ? "—" : `${cur.adherence}%`} cur={cur.adherence} prev={prev.adherence} color={PU} fmt={(v) => `${v}pt`} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: PU, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Athlete</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <Metric label="Sessions" value={cur.sessions} cur={cur.sessions} prev={prev.sessions} color={PU} />
                <Metric label="Volume lifted" value={cur.volume ? `${cur.volume.toLocaleString()}kg` : "—"} cur={cur.volume || null} prev={prev.volume || null} color={PU} fmt={(v) => `${Math.round(v).toLocaleString()}kg`} />
                <Metric label="Cardio minutes" value={cur.cardioMin || "—"} cur={cur.cardioMin || null} prev={prev.cardioMin || null} color={CY} fmt={(v) => `${v}m`} />
                <Metric label="Nutrition days" value={cur.nutriDays || "—"} cur={cur.nutriDays || null} prev={prev.nutriDays || null} color={GR} />
                <Metric label="Avg calories" value={cur.nutriKcal == null ? "—" : cur.nutriKcal.toLocaleString()} cur={cur.nutriKcal} prev={prev.nutriKcal} color={AM} fmt={(v) => `${Math.round(v)}`} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: AM, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Finance · Faith · Mind</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <Metric label="Income logged" value={cur.income ? kes(cur.income) : "—"} cur={cur.income || null} prev={prev.income || null} color={GR} fmt={(v) => kes(v)} />
                <Metric label="Spiritual consistency" value={cur.spiritualPct == null ? "—" : `${cur.spiritualPct}%`} cur={cur.spiritualPct} prev={prev.spiritualPct} color={AM} fmt={(v) => `${v}pt`} />
                <Metric label="Sundays at church" value={cur.church || "—"} cur={cur.church || null} prev={prev.church || null} color={AM} />
                <Metric label="Books/courses done" value={cur.booksDone || "—"} cur={cur.booksDone || null} prev={prev.booksDone || null} color={AN} />
                <Metric label="Decisions logged" value={cur.decisionsLogged || "—"} cur={cur.decisionsLogged || null} prev={prev.decisionsLogged || null} color={AN} />
              </div>
            </div>
          </div>
        )}

        {tab === "trends" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 980 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Trends & correlations</div>
              <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>Ten weekly buckets. Patterns, not verdicts — correlation isn't causation, but it's a place to look.</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
              <CorrCard title="Sleep vs Habits" sub="Avg sleep logged (bars) · habit consistency % (line)"
                barKey="sleepAvg" barName="sleep h" barColor={PU} lineKey="habitPct" lineName="habits %" r={rSleep} />
              <CorrCard title="Training vs Consistency" sub="Sessions per week (bars) · habit consistency % (line)"
                barKey="sessions" barName="sessions" barColor={CY} lineKey="habitPct" lineName="habits %" r={rTrain} />
              <CorrCard title="Prayer vs Journaling" sub="Spiritual consistency % (bars) · journal entries (line)"
                barKey="spiritualPct" barName="spiritual %" barColor={AM} lineKey="journal" lineName="entries" r={rFaith} />

              <Card style={{ padding: "18px" }}>
                <SH title="Checklist vs P&L" sub="Process discipline against outcomes — all closed, checklist-gated trades" />
                {edge.total < 3 ? (
                  <div style={{ padding: "22px 8px", fontSize: 12, color: T3, textAlign: "center" }}>Needs at least 3 checklist-gated closed trades.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["Full checklist", edge.full, GR], ["Items skipped", edge.partial, RE]].map(([l, g, c]) => (
                      <div key={l} style={{ background: GL, border: `1px solid ${c}33`, borderRadius: 11, padding: "13px 14px" }}>
                        <div style={{ fontSize: 10, color: c, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>{l}</div>
                        <div style={{ fontSize: 12, color: T2, lineHeight: 1.9 }}>
                          Trades: <span style={{ color: T1, fontFamily: "monospace" }}>{g.n}</span><br />
                          Win rate: <span style={{ color: T1, fontFamily: "monospace" }}>{g.wr == null ? "—" : `${g.wr}%`}</span><br />
                          Avg P&L: <span style={{ color: (g.avgPnl || 0) >= 0 ? GR : RE, fontFamily: "monospace" }}>{g.avgPnl == null ? "—" : usd(g.avgPnl)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === "xp" && (() => {
          const cats = Object.entries(xp.byCat).filter(([c]) => c !== "awards").sort((a, b) => b[1] - a[1]);
          const catMax = Math.max(1, ...cats.map(([, v]) => v));
          const CAT_COLOR = { life: GR, trading: CY, fitness: PU, finance: AM, faith: "#B09A6F", mind: "#767FA6" };
          const gotList = xp.achievements.filter((a) => a.got);
          return (
            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 980 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Progression</div>
                <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>XP is earned by doing the work — every pillar reports in. The formulas stay under the hood.</div>
              </div>

              <Card style={{ padding: "20px 22px", background: `linear-gradient(180deg,${AM}0A,transparent)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center", minWidth: 90 }}>
                    <div style={{ fontSize: 44, fontWeight: 900, color: AM, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1, textShadow: `0 0 30px ${AM}44` }}>{xp.level}</div>
                    <div style={{ fontSize: 9, color: T3, letterSpacing: 2, marginTop: 4 }}>LEVEL</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                      <span style={{ padding: "3px 12px", background: `${AM}14`, border: `1px solid ${AM}44`, borderRadius: 13, fontSize: 11.5, fontWeight: 700, color: AM, letterSpacing: 1 }}>{xp.title}</span>
                      <span style={{ fontSize: 11, color: T3 }}>{(xp.nextLevelXp - xp.total).toLocaleString()} XP to level {xp.level + 1}</span>
                    </div>
                    <Meter pct={xp.pctToNext} height={8} fill={`linear-gradient(90deg,${AM}77,${AM})`} glow={`${AM}55`} style={{ marginBottom: 7 }} />
                    <div style={{ fontSize: 11.5, color: T2 }}>Lifetime: <span style={{ color: T1, fontWeight: 700, fontFamily: "monospace" }}>{xp.total.toLocaleString()} XP</span></div>
                  </div>
                </div>
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
                <Chip label="Today" value={xp.today.toLocaleString()} color={GR} />
                <Chip label="Last 7 days" value={xp.week.toLocaleString()} color={CY} />
                <Chip label="This month" value={xp.month.toLocaleString()} color={PU} />
                <Chip label="This year" value={xp.year.toLocaleString()} color={AM} />
                <Chip label="Avg/day (30d)" value={xp.avg30.toLocaleString()} color={T2} />
                <Chip label="From streaks" value={xp.streakXp.toLocaleString()} color={GR} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
                <Card style={{ padding: "18px" }}>
                  <SH title="XP by pillar" sub="Where your effort has been landing" />
                  {cats.length === 0 && <div style={{ padding: "18px 4px", fontSize: 12, color: T3, textAlign: "center" }}>Complete anything — a habit, a trade, a workout — and it lands here.</div>}
                  {cats.map(([c, v]) => (
                    <div key={c} style={{ marginBottom: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: T2 }}>{CAT_LABEL[c] || c}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: CAT_COLOR[c] || T2, fontFamily: "monospace" }}>{v.toLocaleString()}</span>
                      </div>
                      <Meter pct={Math.round((v / catMax) * 100)} color={CAT_COLOR[c] || T3} />
                    </div>
                  ))}
                  {xp.bestDay && (
                    <div style={{ fontSize: 11, color: T3, marginTop: 6 }}>
                      Best day: <span style={{ color: AM, fontWeight: 700, fontFamily: "monospace" }}>{xp.bestDay[1].toLocaleString()} XP</span> on {new Date(`${xp.bestDay[0]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                </Card>

                <Card style={{ padding: "18px" }}>
                  <SH title="XP per week" sub="Last 12 weeks — consistency, not spikes" />
                  <ResponsiveContainer width="100%" height={190}>
                    <ComposedChart data={xp.weekly} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                      <XAxis dataKey="label" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={mkTT("", " XP")} />
                      <Line type="monotone" dataKey="xp" name="XP" stroke={AM} strokeWidth={2} dot={{ fill: AM, r: 2.5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <Card onClick={onNavigate ? () => onNavigate("journey") : undefined}
                style={{ padding: "18px", cursor: onNavigate ? "pointer" : "default" }}>
                <SH title="Hall of Fame" sub={`${gotList.length}/${xp.achievements.length} milestones claimed across ${xp.journeys.length} lifelong journeys`} action={<Trophy size={13} color={AM} />} />
                <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>
                  Milestones, ranks and lifetime records live in <span style={{ color: AM, fontWeight: 700 }}>Journey → Hall of Fame</span>{onNavigate ? " — tap to open." : "."}
                </div>
              </Card>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
