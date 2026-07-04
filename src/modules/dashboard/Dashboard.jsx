import { useState, useEffect } from "react";
import { Cpu, CheckCircle, Check, Flame, Activity as ActivityIcon, TrendingUp, DollarSign, Dumbbell, Target, ChevronRight } from "lucide-react";
import { BD, T1, T2, T3, GL, GL2, CY, PU, GR, RE, AM, OR } from "../../shared/designTokens.js";
import { Card, SH, Chip } from "../../shared/ui.jsx";
import { getActiveKillzone, getEATTimeStr } from "../trading/timezone.js";
import { useStorageState } from "../../shared/useStorageState.js";
import { DonutChart, ChartLegend, ActivityHeatmap } from "../../shared/charts.jsx";
import { nextSmallAction, nudgeOfTheDay, compound } from "../../shared/kaizen.js";
import { getStats, tradingMetrics } from "../trading/helpers.js";
import { financeSummary } from "../finance/summary.js";
import { financeHealth } from "../finance/financeHealth.js";
import { incomeAnalytics } from "../finance/income.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";
import { WEEK_PLAN } from "../athlete/constants.js";
import { getDayName } from "../athlete/helpers.js";
import { computeDomains } from "./domains.js";
import { LifeMatrix } from "./LifeMatrix.jsx";

const usd = (n) => `$${Math.round(+n || 0).toLocaleString()}`;

export function Dashboard({ onNavigate, habits, setHabits }) {
  const [kz, setKz] = useState(getActiveKillzone);
  const [eatTime, setEatTime] = useState(getEATTimeStr);
  const [trades] = useStorageState("ict_trades", []);
  const [bal] = useStorageState("ict_balance", 15000);
  const [workouts] = useStorageState("athlete_workouts", []);
  const [finance] = useStorageState("finance_state", DEFAULT_FINANCE_STATE);

  useEffect(() => {
    const t = setInterval(() => { setKz(getActiveKillzone()); setEatTime(getEATTimeStr()); }, 30000);
    return () => clearInterval(t);
  }, []);

  // ── TRADING (own environment) ──────────────────────────────────────
  const tStats = getStats(trades);
  const tMetrics = tradingMetrics(trades, bal, finance.tradingWithdrawals || 0, finance.profitSplit || 80);
  const openTrades = trades.filter((t) => t.status === "OPEN" && !t.archived).length;

  // ── FINANCE ────────────────────────────────────────────────────────
  const fin = financeSummary(finance);
  const fmtKES = (n) => (finance.currency === "USD" ? usd((+n || 0) / fin.xRate) : `KES ${Math.round(+n || 0).toLocaleString()}`);
  const incomeStats = incomeAnalytics(finance.income || []);
  const health = financeHealth({
    incomeStats, totalBudgeted: fin.totalBudgeted, totalSpent: fin.totalSpent,
    efBal: +finance.efBal || 0, savBal: +finance.savBal || 0, totalInvested: fin.totalInvested,
    personalDebt: fin.personalDebt, tradingStats: tStats,
  });
  const goals = (finance.goals || []).filter((g) => !g.archived);
  const goalAgg = goals.length
    ? Math.round(goals.reduce((s, g) => s + (g.target > 0 ? Math.min(1, (+g.current || 0) / g.target) : 0), 0) / goals.length * 100)
    : 0;
  const topGoal = [...goals].sort((a, b) => {
    const pa = a.target > 0 ? (+a.current || 0) / a.target : 1;
    const pb = b.target > 0 ? (+b.current || 0) / b.target : 1;
    return pa - pb;
  })[0];

  // ── ATHLETE ────────────────────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const thisWeek = workouts.filter((w) => new Date(w.date) >= weekStart);
  const strengthWk = thisWeek.filter((w) => w.type === "strength").length;
  const cardioWk = thisWeek.filter((w) => w.type === "cardio").length;
  const sessionsWk = thisWeek.length;
  const streak = (() => {
    let c = 0, d = new Date();
    const dates = new Set(workouts.map((w) => w.date));
    for (let i = 0; i < 60; i++) {
      const ds = d.toISOString().split("T")[0];
      if (dates.has(ds)) { c++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); continue; }
      else break;
    }
    return c;
  })();
  const todayPlan = WEEK_PLAN.find((d) => d.day === getDayName());
  const todayLogged = workouts.some((w) => w.date === todayStr);

  // ── HABITS ─────────────────────────────────────────────────────────
  const doneHabits = habits.filter((h) => h.done).length;
  const habitsPct = habits.length ? Math.round((doneHabits / habits.length) * 100) : 0;
  const topStreak = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0);
  const undoneHabits = habits.filter((h) => !h.done);

  // ── DOMAINS (real) ─────────────────────────────────────────────────
  const domains = computeDomains({
    tradingWr: tStats.wr, hasTrades: tStats.total > 0, sessionsWk,
    financeScore: health.overall, habitsPct, streak,
  });
  const domainPie = domains.map((d) => ({ name: d.label, value: d.score, color: d.color }));
  const lifeScore = Math.round(domains.reduce((s, d) => s + d.score, 0) / domains.length);

  // ── ACTIVITY HEATMAP ───────────────────────────────────────────────
  const activityCounts = {};
  trades.forEach((t) => { if (t.date) activityCounts[t.date] = (activityCounts[t.date] || 0) + 1; });
  workouts.forEach((w) => { if (w.date) activityCounts[w.date] = (activityCounts[w.date] || 0) + 1; });
  const activeDays = Object.keys(activityCounts).length;
  const totalActivity = Object.values(activityCounts).reduce((s, c) => s + c, 0);

  // ── KAIZEN ─────────────────────────────────────────────────────────
  const action = nextSmallAction({ habits, workouts, trades });
  const nudge = nudgeOfTheDay();
  const yearMultiple = compound(365).toFixed(0);

  // ── LIVE DAILY BRIEF ───────────────────────────────────────────────
  const brief = [];
  if (openTrades > 0) brief.push({ i: "📊", t: `${openTrades} open trade${openTrades > 1 ? "s" : ""} — total open risk ${usd(tMetrics.openRisk)} (${tMetrics.openRiskPct}% of account). Manage stops before adding size.` });
  else if (tStats.total > 0) brief.push({ i: "📊", t: `Trading: ${tStats.wr}% win rate over ${tStats.total} closed trades. Today ${tMetrics.dailyPnl >= 0 ? "+" : ""}${usd(tMetrics.dailyPnl)}, this week ${tMetrics.weeklyPnl >= 0 ? "+" : ""}${usd(tMetrics.weeklyPnl)}.` });
  else brief.push({ i: "📊", t: "No trades logged yet. Complete the pre-trade checklist and log your first trade to start building your edge." });

  if (!todayLogged && todayPlan && todayPlan.type !== "Rest") brief.push({ i: "💪", t: `Today is ${todayPlan.type} day. ${sessionsWk} session${sessionsWk === 1 ? "" : "s"} logged this week — even a short version keeps the streak (${streak}d) alive.` });
  else if (todayLogged) brief.push({ i: "💪", t: `Workout logged today — ${sessionsWk} this week, ${streak}-day streak. Recovery is part of the plan.` });
  else brief.push({ i: "💪", t: `Rest day. ${sessionsWk} sessions logged this week. Protein + sleep are today's training.` });

  if (fin.totalBudgeted > 0 && fin.totalSpent > fin.totalBudgeted) brief.push({ i: "💰", t: `Over budget by ${fmtKES(fin.totalSpent - fin.totalBudgeted)} this cycle. Redirect discretionary spend toward your emergency fund.` });
  else if (fin.thisMonthIncome > 0) brief.push({ i: "💰", t: `Income this month: ${fmtKES(fin.thisMonthIncome)}. Net worth ${fmtKES(fin.personalNetWorth)}, passive ${fmtKES(fin.monthlyPassive)}/mo. Financial health ${health.overall}/100.` });
  else brief.push({ i: "💰", t: `Net worth ${fmtKES(fin.personalNetWorth)}. Log income and set budgets to unlock full financial analytics.` });

  brief.push({ i: "✅", t: `${doneHabits}/${habits.length} habits done today${topStreak > 0 ? ` · longest streak ${topStreak} days` : ""}. ${undoneHabits.length ? `Next up: ${undoneHabits[0].name}.` : "All habits complete — excellent."}` });

  // ── TODAY'S PRIORITIES (derived, actionable) ───────────────────────
  const priorities = [];
  undoneHabits.slice(0, 3).forEach((h, i) => priorities.push({ key: `h${i}`, t: h.name, d: "HABIT", u: false, habit: h, nav: "life" }));
  if (!todayLogged && todayPlan && todayPlan.type !== "Rest") priorities.push({ key: "w", t: `${todayPlan.type} workout`, d: "ATHLETE", u: true, nav: "athlete" });
  if (openTrades > 0) priorities.push({ key: "t", t: `Review ${openTrades} open trade${openTrades > 1 ? "s" : ""}`, d: "TRADING", u: true, nav: "trading" });
  if (topGoal && topGoal.target > 0 && (+topGoal.current || 0) / topGoal.target < 1) priorities.push({ key: "g", t: `Fund "${topGoal.name}"`, d: "FINANCE", u: false, nav: "finance" });

  const toggleHabit = (name) => setHabits((p) => p.map((x) => (x.name === name ? { ...x, done: !x.done } : x)));

  const clickCard = { cursor: "pointer", transition: "border-color 0.2s, transform 0.15s" };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Status bar */}
      <div style={{ padding: "10px 18px", background: `${kz.color}11`, border: `1px solid ${kz.color}33`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: kz.active ? kz.color : T3, boxShadow: kz.active ? `0 0 10px ${kz.color}` : undefined }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: kz.color, letterSpacing: 1 }}>{kz.label.toUpperCase()}</span>
          {kz.active && <span style={{ fontSize: 11, color: T3 }}>Active now (Nairobi)</span>}
        </div>
        <span style={{ fontSize: 11, color: T3 }}>{eatTime} EAT · Life Score {lifeScore}</span>
      </div>

      {/* Kaizen 1% */}
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

      {/* Module summary cards — clickable, real data */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
        <ModuleCard color={CY} icon={<TrendingUp size={15} color={CY} />} title="Trading OS" onClick={() => onNavigate("trading")}
          main={usd(tMetrics.equity)} mainLabel="Equity" sub={`${tStats.total ? tStats.wr + "% WR · " : ""}${tMetrics.totalProfit >= 0 ? "+" : ""}${usd(tMetrics.totalProfit)} total`}
          extra={openTrades > 0 ? `${openTrades} open` : `${tStats.total} trades`} extraColor={tMetrics.totalProfit >= 0 ? GR : RE} />
        <ModuleCard color={GR} icon={<DollarSign size={15} color={GR} />} title="Finance OS" onClick={() => onNavigate("finance")}
          main={fmtKES(fin.personalNetWorth)} mainLabel="Net Worth" sub={`Health ${health.overall}/100 · ${fmtKES(fin.monthlyPassive)}/mo passive`}
          extra={`${health.band}`} extraColor={health.overall >= 66 ? GR : health.overall >= 40 ? AM : RE} />
        <ModuleCard color={PU} icon={<Dumbbell size={15} color={PU} />} title="Athlete OS" onClick={() => onNavigate("athlete")}
          main={`${sessionsWk}`} mainLabel="Sessions this week" sub={`${strengthWk} strength · ${cardioWk} cardio`}
          extra={`${streak}d streak`} extraColor={AM} />
        <ModuleCard color={OR} icon={<Target size={15} color={OR} />} title="Goals" onClick={() => onNavigate("finance")}
          main={`${goalAgg}%`} mainLabel={topGoal ? topGoal.name : "Avg progress"} sub={goals.length ? `${goals.length} active goal${goals.length > 1 ? "s" : ""}` : "No goals set"}
          extra={topGoal ? `${topGoal.icon}` : ""} extraColor={OR} />
      </div>

      {/* Life Matrix + Daily Brief */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Card style={{ padding: "24px 24px 24px 20px", flexShrink: 0, maxWidth: "100%" }}>
          <div style={{ fontSize: 10, color: T3, letterSpacing: 3, marginBottom: 18, textTransform: "uppercase" }}>Life Matrix</div>
          <LifeMatrix size={220} domains={domains} />
        </Card>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 13, minWidth: 280 }}>
          <Card style={{ padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
              <div style={{ width: 27, height: 27, borderRadius: 8, background: `${CY}22`, border: `1px solid ${CY}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Cpu size={13} color={CY} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: CY, letterSpacing: 2.5 }}>ARCHITECT DAILY BRIEF</div>
                <div style={{ fontSize: 10, color: T3 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · live from your data</div>
              </div>
            </div>
            {brief.map((x, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 11px", background: GL, borderRadius: 9, border: `1px solid ${BD}`, marginBottom: 7 }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{x.i}</span>
                <span style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{x.t}</span>
              </div>
            ))}
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Chip label="Trading Equity"  value={usd(tMetrics.equity)} color={GR} />
            <Chip label="This Week"        value={`${sessionsWk} sessions`} color={PU} />
            <Chip label="Financial Health" value={`${health.overall}/100`} color={health.overall >= 66 ? GR : AM} />
            <Chip label="Top Habit Streak" value={`${topStreak} days`}  color={CY} />
          </div>
        </div>
      </div>

      {/* Domain performance (real, clickable) */}
      <div>
        <div style={{ fontSize: 10, color: T3, letterSpacing: 3, marginBottom: 11, textTransform: "uppercase" }}>Domain Performance · computed from your activity</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 11 }}>
          {domains.map(({ key, label, color, score }) => (
            <Card key={key} style={{ padding: "13px", ...clickCard }}
              onClick={() => onNavigate(key === "social" ? "relations" : key)}>
              <div style={{ fontSize: 9, color: T3, letterSpacing: 2, marginBottom: 7, textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{score}</div>
              <div style={{ height: 3, background: BD, borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${score}%`, background: `linear-gradient(90deg,${color}55,${color})`, borderRadius: 2 }} />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <Card style={{ padding: "18px" }}>
          <SH title="Domain Balance" sub="Relative weight across all 6 domains" />
          <DonutChart data={domainPie} height={200} centerLabel={lifeScore} centerSub="Life Score" />
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

      {/* Habits + Priorities */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <Card style={{ padding: "18px" }}>
          <SH title="Today's Habits" sub={`${doneHabits}/${habits.length} complete`} action={
            <div style={{ display: "flex", gap: 3 }}>
              {habits.map((_, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < doneHabits ? GR : "rgba(255,255,255,0.15)" }} />)}
            </div>
          } />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {habits.map((h) => (
              <div key={h.name} onClick={() => toggleHabit(h.name)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 25, height: 25, borderRadius: 7, background: h.done ? `${GR}22` : GL, border: `1px solid ${h.done ? GR + "44" : BD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{h.icon}</div>
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
          <SH title="Today's Priorities" sub="Pulled from your habits, plan and open items" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {priorities.length === 0 && (
              <div style={{ padding: "20px", textAlign: "center", color: T3, fontSize: 12.5 }}>Everything's handled. Rest is productive too. 🌱</div>
            )}
            {priorities.map((x) => (
              <div key={x.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div onClick={() => (x.habit ? toggleHabit(x.habit.name) : onNavigate(x.nav))} style={{ width: 18, height: 18, borderRadius: 5, background: GL, border: "1.5px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                  {x.habit && x.habit.done && <Check size={10} color={GR} />}
                </div>
                <span onClick={() => onNavigate(x.nav)} style={{ flex: 1, fontSize: 12.5, color: T1, cursor: "pointer" }}>{x.t}</span>
                <span onClick={() => onNavigate(x.nav)} style={{ fontSize: 9, letterSpacing: 0.8, padding: "2px 6px", borderRadius: 10, background: x.u ? `${AM}22` : GL, color: x.u ? AM : T3, border: `1px solid ${x.u ? AM + "44" : BD}`, whiteSpace: "nowrap", cursor: "pointer" }}>{x.d}</span>
                <ChevronRight size={13} color={T3} style={{ cursor: "pointer" }} onClick={() => onNavigate(x.nav)} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ModuleCard({ color, icon, title, main, mainLabel, sub, extra, extraColor, onClick }) {
  return (
    <Card onClick={onClick}
      style={{ padding: "16px 18px", cursor: "pointer", borderColor: color + "22", transition: "border-color 0.2s, transform 0.15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color + "66"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = color + "22"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: T1 }}>{title}</span>
        </div>
        <ChevronRight size={14} color={T3} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{main}</div>
      <div style={{ fontSize: 10.5, color: T3, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mainLabel}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
        <span style={{ fontSize: 10.5, color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
        {extra && <span style={{ fontSize: 10, fontWeight: 700, color: extraColor, whiteSpace: "nowrap" }}>{extra}</span>}
      </div>
    </Card>
  );
}
