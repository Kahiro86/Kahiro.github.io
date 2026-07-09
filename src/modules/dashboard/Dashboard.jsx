// ── Command Center (Kaizen phase 2) ─────────────────────────────────
// The OS home: only what matters today. Every card answers one of the
// three questions — what should I do now, how am I improving, what's the
// next step. All numbers are memoized reads of the real stores.
import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Cpu, Check, Flame, Activity as ActivityIcon, TrendingUp, DollarSign, Dumbbell, Target, ChevronRight, Plus, Calendar, Zap, PenLine } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, RE, AM, OR, B2 } from "../../shared/designTokens.js";
import { Card, SH, Chip, Hydrating } from "../../shared/ui.jsx";
import { getActiveKillzone, getEATTimeStr } from "../trading/timezone.js";
import { useStorageState } from "../../shared/useStorageState.js";
import { ActivityHeatmap } from "../../shared/charts.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { nextSmallAction, nudgeOfTheDay } from "../../shared/kaizen.js";
import { getStats, tradingMetrics } from "../trading/helpers.js";
import { financeSummary } from "../finance/summary.js";
import { financeHealth } from "../finance/financeHealth.js";
import { incomeAnalytics } from "../finance/income.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";
import { WEEK_PLAN } from "../athlete/constants.js";
import { getDayName } from "../athlete/helpers.js";
import { localDateStr } from "../../shared/dates.js";
import {
  isScheduled, isDone, isNonNeg, isWellness, isWeekly, valueOn, tapHabit,
} from "../../shared/habitEngine.js";
import { disciplineScore, disciplineSeries } from "../../shared/discipline.js";
import { momentum } from "../../shared/momentum.js";
import { sanitizeMissions, newMission, toggleMission, nextActions } from "../../shared/missions.js";
import { getGcalConfig, todaysEvents } from "../../shared/gcal.js";
import { pendingReviews, sanitizeReviews } from "../trading/reviews.js";
import { billsDueSoon } from "../finance/bills.js";
import { NonNegotiables } from "../life/NonNegotiables.jsx";

const usd = (n) => `$${Math.round(+n || 0).toLocaleString()}`;

function Ring({ pct, size = 108, stroke = 9, color = GR, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BD} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(Math.min(100, pct) / 100) * c} ${c}`} style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

export function Dashboard({ onNavigate, habits: habitsV2, setHabits, loaded = true }) {
  const [kz, setKz] = useState(getActiveKillzone);
  const [eatTime, setEatTime] = useState(getEATTimeStr);
  const [trades] = useStorageState("ict_trades", []);
  const [rawBal] = useStorageState("ict_balance", 15000);
  const bal = Number.isFinite(+rawBal) && +rawBal > 0 ? +rawBal : 15000;
  const [workouts] = useStorageState("athlete_workouts", []);
  const [finance] = useStorageState("finance_state", DEFAULT_FINANCE_STATE);
  const [entries, setEntries] = useStorageState("journal_entries", []);
  const [rawMissions, setMissions] = useStorageState("missions", []);
  const [rawReviews] = useStorageState("ict_reviews", []);
  const [missionDraft, setMissionDraft] = useState("");
  const [journalDraft, setJournalDraft] = useState("");
  const [journalSaved, setJournalSaved] = useState(false);

  useEffect(() => {
    const t = setInterval(() => { setKz(getActiveKillzone()); setEatTime(getEATTimeStr()); }, 30000);
    return () => clearInterval(t);
  }, []);

  const ds = localDateStr();
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Deep work hours" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // ── HABITS (engine v2) ─────────────────────────────────────────────
  const active = useMemo(() => habitsV2.filter((h) => !h.archived && !h.paused), [habitsV2]);
  const scheduledToday = useMemo(() => active.filter((h) => isScheduled(h, ds)), [active, ds]);
  const doneToday = scheduledToday.filter((h) => isDone(h, ds)).length;
  const ringPct = scheduledToday.length ? Math.round((doneToday / scheduledToday.length) * 100) : 0;
  const nonNegs = useMemo(() => active.filter((h) => isNonNeg(h) && !isWeekly(h)), [active]);
  const wellness = useMemo(() => active.filter(isWellness), [active]);
  const tapId = (id) => setHabits((prev) => tapHabit(prev, id));

  // ── ENGINES ────────────────────────────────────────────────────────
  const entriesSafe = useMemo(() => (Array.isArray(entries) ? entries : []).filter((e) => e && e.id), [entries]);
  const weekPlanDays = WEEK_PLAN.filter((d) => d.type !== "Rest").length;
  const disc = useMemo(
    () => disciplineScore({ habits: habitsV2, trades, workouts, entries: entriesSafe, weekPlanDays }),
    [habitsV2, trades, workouts, entriesSafe, weekPlanDays]
  );
  const mom = useMemo(() => momentum(habitsV2), [habitsV2]);
  const discSeries = useMemo(() => disciplineSeries({ habits: habitsV2 }, 12), [habitsV2]);

  // ── MISSIONS ───────────────────────────────────────────────────────
  const missions = useMemo(() => sanitizeMissions(rawMissions), [rawMissions]);
  const todayMissions = useMemo(() => nextActions(missions, 5), [missions]);
  const addMission = () => {
    const title = missionDraft.trim();
    if (!title) return;
    setMissions((prev) => [...sanitizeMissions(prev), newMission({ level: "day", title, due: ds })]);
    setMissionDraft("");
  };

  // ── AGENDA (Google Calendar) ───────────────────────────────────────
  const [agenda, setAgenda] = useState({ state: getGcalConfig() ? "loading" : "off", events: [] });
  useEffect(() => {
    if (!getGcalConfig()) return;
    let cancelled = false;
    todaysEvents(false)
      .then((events) => { if (!cancelled) setAgenda({ state: "ok", events }); })
      .catch(() => { if (!cancelled) setAgenda({ state: "consent", events: [] }); });
    return () => { cancelled = true; };
  }, []);
  const agendaConsent = async () => {
    try { setAgenda({ state: "ok", events: await todaysEvents(true) }); }
    catch { setAgenda({ state: "consent", events: [] }); }
  };

  // ── TRADING / FINANCE / ATHLETE (unchanged memoized reads) ─────────
  const tStats = useMemo(() => getStats(trades), [trades]);
  const tMetrics = useMemo(() => tradingMetrics(trades, bal, finance.tradingWithdrawals || 0, finance.profitSplit || 80), [trades, bal, finance.tradingWithdrawals, finance.profitSplit]);
  const openTrades = useMemo(() => trades.filter((t) => t.status === "OPEN" && !t.archived).length, [trades]);
  const reviewsDue = useMemo(() => pendingReviews(trades, sanitizeReviews(rawReviews)).length, [trades, rawReviews]);
  const fin = useMemo(() => financeSummary(finance), [finance]);
  const fmtKES = (n) => (finance.currency === "USD" ? usd((+n || 0) / fin.xRate) : `KES ${Math.round(+n || 0).toLocaleString()}`);
  const incomeStats = useMemo(() => incomeAnalytics(finance.income || []), [finance.income]);
  const health = useMemo(() => financeHealth({
    incomeStats, totalBudgeted: fin.totalBudgeted, totalSpent: fin.totalSpent,
    efBal: +finance.efBal || 0, savBal: +finance.savBal || 0, totalInvested: fin.totalInvested,
    personalDebt: fin.personalDebt, tradingStats: tStats,
  }), [incomeStats, fin, finance.efBal, finance.savBal, tStats]);
  const goals = (Array.isArray(finance.goals) ? finance.goals : []).filter((g) => g && !g.archived);
  const goalAgg = goals.length
    ? Math.round(goals.reduce((s, g) => s + (g.target > 0 ? Math.min(1, (+g.current || 0) / g.target) : 0), 0) / goals.length * 100)
    : 0;
  const topGoal = [...goals].sort((a, b) => {
    const pa = a.target > 0 ? (+a.current || 0) / a.target : 1;
    const pb = b.target > 0 ? (+b.current || 0) / b.target : 1;
    return pa - pb;
  })[0];

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const thisWeek = workouts.filter((w) => new Date(w.date) >= weekStart);
  const sessionsWk = thisWeek.length;
  const todayPlan = WEEK_PLAN.find((d) => d.day === getDayName());
  const todayLogged = workouts.some((w) => w.date === ds);

  // ── UNIFIED HEATMAP: any meaningful action, any OS ─────────────────
  const activityCounts = useMemo(() => {
    const c = {};
    const add = (d) => { if (d) c[d] = (c[d] || 0) + 1; };
    trades.forEach((t) => add(t?.date));
    workouts.forEach((w) => add(w?.date));
    entriesSafe.forEach((e) => add((e.date || "").slice(0, 10)));
    for (const h of active) for (const [d, e] of Object.entries(h.log || {})) if ((e?.v || 0) >= (h.target || 1)) add(d);
    return c;
  }, [trades, workouts, entriesSafe, active]);
  const activeDays = Object.keys(activityCounts).length;

  // ── QUICK JOURNAL ──────────────────────────────────────────────────
  const saveJournal = () => {
    const text = journalDraft.trim();
    if (!text) return;
    setEntries((prev) => [{ id: `j${Date.now()}`, date: new Date().toISOString(), text }, ...(Array.isArray(prev) ? prev : [])]);
    setJournalDraft("");
    setJournalSaved(true);
    setTimeout(() => setJournalSaved(false), 2500);
  };

  const action = nextSmallAction({ habits: active.map((h) => ({ name: h.name, done: isDone(h, ds) })), workouts, trades });
  const nudge = nudgeOfTheDay();

  if (!loaded) return <Hydrating label="Waking the Command Center…" />;

  return (
    <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Greeting + status ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: T1 }}>{greeting}, Irisu.</div>
          <div style={{ fontSize: 12, color: T3, marginTop: 3 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {eatTime} EAT
          </div>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", background: `${kz.color}11`, border: `1px solid ${kz.color}33`, borderRadius: 10, fontSize: 11, fontWeight: 700, color: kz.color, letterSpacing: 0.5 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: kz.active ? kz.color : T3 }} />
          {kz.active ? kz.label.toUpperCase() : "MARKET QUIET"}
        </span>
      </div>

      {/* ── Hero: ring, discipline, momentum ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
        <Card style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 18 }}>
          <Ring pct={ringPct} color={ringPct === 100 ? GR : CY}>
            <div style={{ fontSize: 22, fontWeight: 900, color: ringPct === 100 ? GR : T1, fontFamily: "'JetBrains Mono',monospace" }}>{ringPct}%</div>
            <div style={{ fontSize: 8, color: T3, letterSpacing: 1.5 }}>TODAY</div>
          </Ring>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>
              {ringPct === 100 && scheduledToday.length ? "Perfect day. ⭐" : `${scheduledToday.length - doneToday} habit${scheduledToday.length - doneToday === 1 ? "" : "s"} to go`}
            </div>
            <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.55, marginTop: 4 }}>{nudge}</div>
            <button onClick={() => onNavigate("life")} style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: CY, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
              Open Life OS <ChevronRight size={12} />
            </button>
          </div>
        </Card>

        <Card style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: T3, letterSpacing: 2, textTransform: "uppercase" }}>Discipline Score</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: disc.score >= 70 ? GR : disc.score >= 40 ? AM : RE, fontFamily: "'JetBrains Mono',monospace" }}>{disc.empty ? "—" : disc.score}</span>
          </div>
          {disc.empty ? (
            <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.6 }}>Complete habits, workouts, journal entries and checklist-gated trades — your score builds from real records.</div>
          ) : disc.domains.map((d) => (
            <div key={d.key} style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T3, marginBottom: 3 }}>
                <span>{d.label}</span><span style={{ fontFamily: "monospace" }}>{Math.round(d.ratio * 100)}%</span>
              </div>
              <div style={{ height: 3.5, background: BD, borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${Math.round(d.ratio * 100)}%`, background: d.ratio >= 0.7 ? GR : d.ratio >= 0.4 ? AM : RE, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </Card>

        <Card style={{ padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: T3, letterSpacing: 2, textTransform: "uppercase" }}>Momentum · 30d</span>
              <Zap size={13} color={mom.delta >= 0 ? GR : AM} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: T1, fontFamily: "'JetBrains Mono',monospace" }}>{mom.value}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: mom.delta > 0 ? GR : mom.delta < 0 ? RE : T3 }}>
                {mom.delta > 0 ? `▲ +${mom.delta}` : mom.delta < 0 ? `▼ ${mom.delta}` : "· steady"} vs last week
              </span>
            </div>
            <div style={{ fontSize: 11, color: T3, lineHeight: 1.55, marginTop: 6 }}>Recent days weigh most. A miss dents it — it never resets.</div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: T2 }}>
            <span>📋 Today's 1%: <span style={{ color: T1 }}>{action.text.length > 46 ? action.text.slice(0, 46) + "…" : action.text}</span></span>
          </div>
        </Card>
      </div>

      {/* ── Non-Negotiables ── */}
      {nonNegs.length > 0 && <NonNegotiables habits={nonNegs} onTap={tapId} />}

      {/* ── Missions + Agenda ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        <Card style={{ padding: "16px 18px" }}>
          <SH title="Today's Missions" sub="Small actions that feed bigger goals" action={<Target size={13} color={PU} />} />
          <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
            <input value={missionDraft} onChange={(e) => setMissionDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMission()}
              placeholder="Add an action for today…"
              style={{ flex: 1, background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit" }} />
            <button onClick={addMission} disabled={!missionDraft.trim()} aria-label="Add mission"
              style={{ width: 34, borderRadius: 9, border: `1px solid ${missionDraft.trim() ? PU + "55" : BD}`, background: missionDraft.trim() ? `${PU}18` : GL, color: missionDraft.trim() ? PU : T3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={14} />
            </button>
          </div>
          {todayMissions.length === 0 ? (
            <div style={{ padding: "14px 6px", fontSize: 12, color: T3, textAlign: "center" }}>No open actions. Add the next meaningful step above.</div>
          ) : todayMissions.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 4px", borderBottom: `1px solid ${BD}` }}>
              <button onClick={() => setMissions((prev) => toggleMission(sanitizeMissions(prev), m.id))} aria-label={`Complete ${m.title}`}
                style={{ width: 18, height: 18, borderRadius: 5, background: GL, border: `1.5px solid ${PU}44`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {m.done && <Check size={11} color={PU} />}
              </button>
              <span style={{ flex: 1, fontSize: 12.5, color: T1 }}>{m.title}</span>
              <span style={{ fontSize: 9, letterSpacing: 0.8, color: T3, textTransform: "uppercase" }}>{m.level}</span>
            </div>
          ))}
        </Card>

        <Card style={{ padding: "16px 18px" }}>
          <SH title="Today's Agenda" sub="Google Calendar · read-only" action={<Calendar size={13} color={AM} />} />
          {agenda.state === "off" && (
            <div style={{ padding: "14px 6px", fontSize: 12, color: T3, lineHeight: 1.6, textAlign: "center" }}>
              Connect Google Calendar in <span style={{ color: T2 }}>Settings</span> to see today's events here.
            </div>
          )}
          {agenda.state === "loading" && <div style={{ padding: "14px 6px", fontSize: 12, color: T3, textAlign: "center" }}>Loading events…</div>}
          {agenda.state === "consent" && (
            <button onClick={agendaConsent} style={{ width: "100%", padding: "10px", background: `${AM}12`, border: `1px dashed ${AM}44`, borderRadius: 10, color: AM, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Tap to reconnect Google Calendar
            </button>
          )}
          {agenda.state === "ok" && agenda.events.length === 0 && (
            <div style={{ padding: "14px 6px", fontSize: 12, color: T3, textAlign: "center" }}>Clear calendar — protect the deep-work hours. 🌱</div>
          )}
          {agenda.state === "ok" && agenda.events.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: `1px solid ${BD}` }}>
              <span style={{ fontSize: 10.5, color: AM, fontFamily: "monospace", width: 62, flexShrink: 0 }}>{e.time}</span>
              <span style={{ fontSize: 12.5, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* ── Module status cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
        <ModuleCard color={CY} icon={<TrendingUp size={15} color={CY} />} title="Trading OS" onClick={() => onNavigate("trading")}
          main={usd(tMetrics.equity)} mainLabel="Equity" sub={`Today ${tMetrics.dailyPnl >= 0 ? "+" : ""}${usd(tMetrics.dailyPnl)} · ${tStats.total ? tStats.wr + "% WR" : "no trades yet"}`}
          extra={reviewsDue > 0 ? `${reviewsDue} review${reviewsDue > 1 ? "s" : ""} due` : openTrades > 0 ? `${openTrades} open` : kz.active ? "session live" : "market quiet"} extraColor={reviewsDue > 0 ? AM : openTrades > 0 ? AM : tMetrics.totalProfit >= 0 ? GR : RE} />
        <ModuleCard color={GR} icon={<DollarSign size={15} color={GR} />} title="Finance OS" onClick={() => onNavigate("finance")}
          main={fmtKES(fin.personalNetWorth)} mainLabel="Net Worth" sub={`Health ${health.overall}/100 · ${fmtKES(fin.monthlyPassive)}/mo passive`}
          extra={billsDueSoon(finance.bills).length > 0 ? `${billsDueSoon(finance.bills).length} bill${billsDueSoon(finance.bills).length > 1 ? "s" : ""} due` : health.band} extraColor={billsDueSoon(finance.bills).length > 0 ? AM : health.overall >= 66 ? GR : health.overall >= 40 ? AM : RE} />
        <ModuleCard color={PU} icon={<Dumbbell size={15} color={PU} />} title="Athlete OS" onClick={() => onNavigate("athlete")}
          main={todayLogged ? "Done ✓" : todayPlan?.type || "—"} mainLabel={todayLogged ? "Today's session logged" : "Today's session"} sub={`${sessionsWk} session${sessionsWk === 1 ? "" : "s"} this week`}
          extra={todayLogged ? "trained" : todayPlan?.type === "Rest" ? "recovery" : "pending"} extraColor={todayLogged ? GR : todayPlan?.type === "Rest" ? T3 : AM} />
        <ModuleCard color={OR} icon={<Target size={15} color={OR} />} title="Goals" onClick={() => onNavigate("finance")}
          main={`${goalAgg}%`} mainLabel={topGoal ? topGoal.name : "Avg progress"} sub={goals.length ? `${goals.length} active goal${goals.length > 1 ? "s" : ""}` : "No goals set"}
          extra={topGoal ? `${topGoal.icon}` : ""} extraColor={OR} />
      </div>

      {/* ── Wellness + quick journal ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        <Card style={{ padding: "16px 18px" }}>
          <SH title="Wellness" sub="Sleep · hydration · prayer — one tap adds progress" />
          {wellness.length === 0 ? (
            <div style={{ padding: "12px 6px", fontSize: 12, color: T3, textAlign: "center" }}>Add the Wellness pack in Life OS → Habits to track sleep, hydration and prayer here.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wellness.map((h) => {
                const v = valueOn(h, ds), target = h.target || 1, done = isDone(h, ds);
                return (
                  <div key={h.id} onClick={() => tapId(h.id)} role="button"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", background: done ? `${h.color}0C` : GL, border: `1px solid ${done ? h.color + "44" : BD}`, borderRadius: 10, cursor: "pointer" }}>
                    <span style={{ fontSize: 14 }}>{h.icon}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: done ? T1 : T2, fontWeight: done ? 600 : 400 }}>{h.name}</span>
                    <div style={{ width: 90, height: 4, background: BD, borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (v / target) * 100)}%`, background: h.color, borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                    <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace", width: 52, textAlign: "right" }}>{v}/{target}{h.unit ? ` ${h.unit}` : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card style={{ padding: "16px 18px" }}>
          <SH title="Quick Journal" sub="One honest line is enough" action={<PenLine size={13} color={CY} />} />
          <textarea value={journalDraft} onChange={(e) => setJournalDraft(e.target.value)} placeholder="What improved today? What did I learn?"
            style={{ width: "100%", minHeight: 66, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: T1, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
          <button onClick={saveJournal} disabled={!journalDraft.trim()}
            style={{ marginTop: 8, width: "100%", padding: "8px", background: journalDraft.trim() ? `${CY}14` : GL, border: `1px solid ${journalDraft.trim() ? CY + "44" : BD}`, borderRadius: 9, color: journalDraft.trim() ? CY : T3, fontSize: 12, fontWeight: 700, cursor: journalDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
            {journalSaved ? "Saved 🌱" : "Save to Journal"}
          </button>
        </Card>
      </div>

      {/* ── Consistency: unified heatmap + progression ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        <Card style={{ padding: "16px 18px" }}>
          <SH title="Unified Consistency" sub="Every meaningful action across every OS — 13 weeks" action={
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T2 }}><ActivityIcon size={11} color={CY} />{activeDays} active days</span>
          } />
          <ActivityHeatmap counts={activityCounts} weeks={13} color={CY} />
        </Card>

        <Card style={{ padding: "16px 18px" }}>
          <SH title="Progression" sub="Weekly habit consistency — direction beats intensity" action={<Flame size={13} color={AM} />} />
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={discSeries} margin={{ top: 6, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BD} />
              <XAxis dataKey="label" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke={T3} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={mkTT("", "%")} />
              <Line type="monotone" dataKey="score" stroke={GR} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Daily brief ── */}
      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `${CY}18`, border: `1px solid ${CY}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Cpu size={12} color={CY} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: CY, letterSpacing: 2.5 }}>KAHIRO DAILY BRIEF</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <Chip label="Trading Equity"   value={usd(tMetrics.equity)} color={GR} />
          <Chip label="Weekly Sessions"  value={`${sessionsWk}`} color={PU} />
          <Chip label="Financial Health" value={`${health.overall}/100`} color={health.overall >= 66 ? GR : AM} />
          <Chip label="Discipline"       value={disc.empty ? "—" : `${disc.score}/100`} color={CY} />
        </div>
      </Card>
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
      <div style={{ fontSize: 21, fontWeight: 900, color, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{main}</div>
      <div style={{ fontSize: 10.5, color: T3, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mainLabel}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
        <span style={{ fontSize: 10.5, color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
        {extra && <span style={{ fontSize: 10, fontWeight: 700, color: extraColor, whiteSpace: "nowrap" }}>{extra}</span>}
      </div>
    </Card>
  );
}
