// ── Command Center — the Today screen ────────────────────────────────
// Opening the app answers three things at a glance: what matters today,
// what needs attention, and what's already done. Everything actionable
// sits at the top; trends and analytics fold away below. All numbers are
// memoized reads of the real stores.
import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Cpu, Check, Flame, Activity as ActivityIcon, TrendingUp, DollarSign, Dumbbell, Target, ChevronRight, Plus, Calendar, Zap, PenLine, BellRing } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, RE, AM, OR, B2 } from "../../shared/designTokens.js";
import { Card, SH, Chip, Hydrating, Meter } from "../../shared/ui.jsx";
import { Collapse } from "../../shared/Collapse.jsx";
import { getActiveKillzone, getEATTimeStr } from "../trading/timezone.js";
import { useStorageState } from "../../shared/useStorageState.js";
import { ActivityHeatmap, Ring } from "../../shared/charts.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { nudgeOfTheDay, dayGreetingLine } from "../../shared/kaizen.js";
import { buildNudges } from "../../shared/insights.js";
import { getStats, tradingMetrics } from "../trading/helpers.js";
import { financeSummary } from "../finance/summary.js";
import { financeHealth } from "../finance/financeHealth.js";
import { incomeAnalytics } from "../finance/income.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";
import { WEEK_PLAN } from "../athlete/constants.js";
import { getDayName } from "../athlete/helpers.js";
import { localDateStr, daysBetween } from "../../shared/dates.js";
import {
  isScheduled, isDone, isNonNeg, isWellness, isWeekly, valueOn, tapHabit,
} from "../../shared/habitEngine.js";
import { disciplineScore, disciplineSeries } from "../../shared/discipline.js";
import { momentum } from "../../shared/momentum.js";
import { sanitizeMissions, newMission, toggleMission, nextActions } from "../../shared/missions.js";
import { goalsSummary, areaOf, goalPct } from "../../shared/goals.js";
import { focusThisWeek, isDismissed, setFocus, dismissFocus, weakestArea } from "../../shared/review.js";
import { sanitizeNutrition, dayEntries } from "../athlete/nutrition.js";
import { getGcalConfig, todaysEvents } from "../../shared/gcal.js";
import { getSyncConfig } from "../../shared/sync.js";
import { pendingReviews, sanitizeReviews } from "../trading/reviews.js";
import { billsDueSoon } from "../finance/bills.js";
import { NonNegotiables } from "../life/NonNegotiables.jsx";

const usd = (n) => `$${Math.round(+n || 0).toLocaleString()}`;

export function Dashboard({ onNavigate, onOpenSettings, habits: habitsV2, setHabits, loaded = true, weekXp = 0 }) {
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
  const [rawGoals] = useStorageState("goals", []);
  const [rawFocus, setRawFocus] = useStorageState("weekly_focus", {});
  const [focusDraft, setFocusDraft] = useState("");
  const [purity] = useStorageState("purity_log", {});
  const [nutritionLog] = useStorageState("nutrition_log", {});
  const [nutritionProfile] = useStorageState("nutrition_profile", null);
  const [verses] = useStorageState("faith_scripture", []);
  const [decisions] = useStorageState("mind_decisions", []);
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

  // ── THIS WEEK: one dot per day (Sun→Sat), classified from the habit log ──
  const weekDays = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay()); // back to Sunday
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const dstr = localDateStr(d);
      const sched = active.filter((h) => isScheduled(h, dstr));
      const done = sched.filter((h) => isDone(h, dstr)).length;
      let state;
      if (dstr > ds) state = "future";
      else if (sched.length === 0) state = "rest";
      else if (done >= sched.length) state = "perfect";
      else if (done > 0) state = "partial";
      else state = "missed";
      out.push({ dstr, letter: "SMTWTFS"[i], state, isToday: dstr === ds, done, sched: sched.length });
    }
    return out;
  }, [active, ds]);
  const onTrackDays = weekDays.filter((d) => d.state === "perfect").length;
  const weekActiveDays = weekDays.filter((d) => d.state !== "rest" && d.state !== "future").length;

  // ── WEEKLY FOCUS: one chosen focus per week, suggested from data ────
  const focus = useMemo(() => focusThisWeek(rawFocus), [rawFocus]);
  const weakest = useMemo(() => weakestArea(active), [active]);
  const activeFocus = focus && !isDismissed(focus) ? focus : null;
  // Prompt to set a focus once a week: only when none is set/skipped yet and
  // there's enough habit history to suggest something meaningful.
  const showReview = !focus && !!weakest;
  const submitFocus = () => {
    const text = focusDraft.trim() || (weakest ? weakest.cat : "");
    if (!text) return;
    setRawFocus((prev) => setFocus(prev, text));
    setFocusDraft("");
  };

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
  // Universal goals (every life area) — the Goals card points at Journey.
  const gsum = useMemo(() => goalsSummary(rawGoals), [rawGoals]);

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

  // ── WELCOME BACK: a compassionate re-entry after a gap ──────────────
  // The single biggest risk to a tracker is a lapse that makes every screen
  // feel accusatory. When someone returns after 3+ quiet days with nothing
  // logged yet today, we lead with warmth, not a wall of missed states —
  // and it vanishes the moment they do anything today.
  const welcomeBack = useMemo(() => {
    if (activityCounts[ds]) return null;               // already active today
    const past = Object.keys(activityCounts).filter((d) => d < ds).sort();
    if (!past.length) return null;                     // brand-new, not a return
    const gap = daysBetween(past[past.length - 1], ds);
    return gap >= 3 ? gap : null;
  }, [activityCounts, ds]);

  // ── QUICK JOURNAL ──────────────────────────────────────────────────
  const saveJournal = () => {
    const text = journalDraft.trim();
    if (!text) return;
    setEntries((prev) => [{ id: `j${Date.now()}`, date: new Date().toISOString(), text }, ...(Array.isArray(prev) ? prev : [])]);
    setJournalDraft("");
    setJournalSaved(true);
    setTimeout(() => setJournalSaved(false), 2500);
  };

  // ── THE ALIVE LAYER: what needs attention right now ────────────────
  // The same rule-based nudge engine the app uses everywhere — surfaced
  // where the day starts. Each one links straight to where it's handled.
  const syncOn = !!getSyncConfig();
  const lastExport = useMemo(() => { try { return +localStorage.getItem("kahiro_last_export") || 0; } catch { return 0; } }, []);
  const nudges = useMemo(
    () => buildNudges({ habits: habitsV2, trades, reviews: rawReviews, bills: finance.bills, verses, decisions, purity, nutrition: nutritionLog, nutritionProfile, syncOn, lastExport }),
    [habitsV2, trades, rawReviews, finance.bills, verses, decisions, purity, nutritionLog, nutritionProfile, syncOn, lastExport]
  );

  // ── DONE TODAY ──────────────────────────────────────────────────────
  const mealsToday = useMemo(() => dayEntries(sanitizeNutrition(nutritionLog), ds).length, [nutritionLog, ds]);
  const journaledToday = useMemo(() => entriesSafe.some((e) => (e.date || "").slice(0, 10) === ds), [entriesSafe, ds]);
  const doneList = [
    { icon: "✅", label: "Habits", done: scheduledToday.length > 0 && doneToday === scheduledToday.length, detail: scheduledToday.length ? `${doneToday}/${scheduledToday.length}` : "none scheduled" },
    { icon: "🏋️", label: "Training", done: todayLogged, detail: todayLogged ? "logged" : todayPlan?.type === "Rest" ? "rest day" : todayPlan?.type || "—" },
    { icon: "🍽️", label: "Meals", done: mealsToday > 0, detail: mealsToday ? `${mealsToday} logged` : "nothing yet" },
    { icon: "📓", label: "Journal", done: journaledToday, detail: journaledToday ? "written" : "one line is enough" },
  ];

  // Warm, time-aware line for the greeting — knows where the day is.
  const openNonNegs = useMemo(() => nonNegs.filter((h) => isScheduled(h, ds) && !isDone(h, ds)).length, [nonNegs, ds]);
  const dayLine = dayGreetingLine({
    hour, scheduled: scheduledToday.length, done: doneToday, openNonNegs,
    workoutPlanned: !!todayPlan && todayPlan.type !== "Rest", workoutDone: todayLogged, journaled: journaledToday,
  });

  const nudge = nudgeOfTheDay();

  if (!loaded) return <Hydrating label="Waking the Command Center…" />;

  return (
    <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Welcome back after a gap — warmth, never guilt ── */}
      {welcomeBack && (
        <Card style={{ padding: "15px 18px", background: `linear-gradient(180deg,${GR}10,transparent)`, borderColor: `${GR}44`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 26 }}>🌱</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T1 }}>Welcome back, Irisu.</div>
            <div style={{ fontSize: 12, color: T2, lineHeight: 1.55, marginTop: 3 }}>
              It's been {welcomeBack} days — and that's completely fine. The habit that matters is returning, and you just did. Start with one small rep; today is a clean page.
            </div>
          </div>
          <button onClick={() => onNavigate("life")}
            style={{ padding: "9px 16px", background: `${GR}18`, border: `1px solid ${GR}55`, borderRadius: 10, color: GR, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Take the first step
          </button>
        </Card>
      )}

      {/* ── Greeting + status ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 21, fontWeight: 800, color: T1 }}>{greeting}, Irisu.</div>
          <div style={{ fontSize: 12, color: T3, marginTop: 3 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {eatTime} EAT
          </div>
          <div style={{ fontSize: 12.5, color: T2, marginTop: 6, maxWidth: 460, lineHeight: 1.5 }}>{dayLine}</div>
          {activeFocus && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 9, padding: "5px 11px", background: `${PU}12`, border: `1px solid ${PU}33`, borderRadius: 9, fontSize: 11.5, color: T2 }}>
              <Target size={12} color={PU} /> This week's focus: <span style={{ color: T1, fontWeight: 600 }}>{activeFocus}</span>
            </div>
          )}
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", background: `${kz.color}11`, border: `1px solid ${kz.color}33`, borderRadius: 10, fontSize: 11, fontWeight: 700, color: kz.color, letterSpacing: 0.5 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: kz.active ? kz.color : T3 }} />
          {kz.active ? kz.label.toUpperCase() : "MARKET QUIET"}
        </span>
      </div>

      {/* ── Weekly review: recap + choose one focus for the week ── */}
      {showReview && (
        <Card style={{ padding: "16px 18px", background: `linear-gradient(180deg,${PU}0C,transparent)`, borderColor: `${PU}3A` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <Target size={14} color={PU} />
            <span style={{ fontSize: 13.5, fontWeight: 800, color: T1 }}>Set your focus for the week</span>
          </div>
          <div style={{ fontSize: 12, color: T2, lineHeight: 1.55, marginBottom: 11 }}>
            Last week you were on track {onTrackDays}/{weekActiveDays || 7} day{weekActiveDays === 1 ? "" : "s"}{weekXp > 0 ? ` and earned ${weekXp.toLocaleString()} XP` : ""}.
            {weakest && weakest.pct < 100 ? <> Your lightest area lately is <span style={{ color: T1, fontWeight: 600 }}>{weakest.cat}</span> ({weakest.pct}% over 30 days) — a good place to aim one small rep a day.</> : " Pick one thing to give a little extra this week."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input value={focusDraft} onChange={(e) => setFocusDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitFocus()}
              placeholder={weakest ? `This week, focus on ${weakest.cat}…` : "This week, I'll focus on…"} aria-label="Weekly focus"
              style={{ flex: 1, minWidth: 200, background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit" }} />
            <button onClick={submitFocus}
              style={{ padding: "9px 16px", background: `${PU}18`, border: `1px solid ${PU}55`, borderRadius: 9, color: PU, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              {focusDraft.trim() ? "Set focus" : weakest ? `Focus on ${weakest.cat}` : "Set focus"}
            </button>
            <button onClick={() => setRawFocus((prev) => dismissFocus(prev))}
              style={{ padding: "9px 12px", background: "none", border: `1px solid ${BD}`, borderRadius: 9, color: T3, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              Maybe later
            </button>
          </div>
        </Card>
      )}

      {/* ── Today hero: progress ring · needs attention · done ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
        <Card style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 18 }}>
          <Ring pct={ringPct} size={108} stroke={9} color={ringPct === 100 ? GR : CY}>
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

        <Card style={{ padding: "16px 18px" }}>
          <SH title="Needs attention" sub={nudges.length ? "Tap anything to handle it" : "Nothing is waiting on you"} action={<BellRing size={13} color={nudges.length ? AM : GR} />} />
          {nudges.length === 0 ? (
            <div style={{ padding: "12px 6px", fontSize: 12, color: T2, textAlign: "center", lineHeight: 1.6 }}>All clear. 🌿 Protect the deep-work hours.</div>
          ) : nudges.slice(0, 4).map((n) => (
            <button key={n.id} onClick={() => (n.nav === "settings" ? onOpenSettings?.() : onNavigate(n.nav))}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 4px", background: "none", border: "none", borderBottom: `1px solid ${BD}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{n.icon}</span>
              <span style={{ flex: 1, fontSize: 11.5, color: n.tone === "urgent" ? T1 : T2, lineHeight: 1.45 }}>{n.text}</span>
              <ChevronRight size={12} color={T3} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </Card>

        <Card style={{ padding: "16px 18px" }}>
          <SH title="Done today" sub="The day's record so far" action={<Check size={13} color={GR} />} />
          {doneList.map((d) => (
            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 4px", borderBottom: `1px solid ${BD}` }}>
              <span style={{ fontSize: 13, filter: d.done ? "none" : "grayscale(1)", opacity: d.done ? 1 : 0.5 }}>{d.icon}</span>
              <span style={{ flex: 1, fontSize: 11.5, color: d.done ? T1 : T3, fontWeight: d.done ? 600 : 400 }}>{d.label}</span>
              <span style={{ fontSize: 10.5, color: d.done ? GR : T3, fontFamily: "monospace" }}>{d.detail}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* ── This week at a glance ── */}
      {active.length > 0 && (
        <Card style={{ padding: "13px 18px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 128 }}>
            <div style={{ fontSize: 10, color: T3, letterSpacing: 1.5, textTransform: "uppercase" }}>This week</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T1, marginTop: 2 }}>
              {weekActiveDays === 0 ? "The week's ahead" : `${onTrackDays}/${weekActiveDays} day${weekActiveDays === 1 ? "" : "s"} on track`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, flex: 1, justifyContent: "center", flexWrap: "wrap" }}>
            {weekDays.map((d) => {
              const col = d.state === "perfect" ? GR : d.state === "partial" ? AM : d.state === "missed" ? RE : T3;
              const fill = d.state === "perfect" || d.state === "partial";
              return (
                <div key={d.dstr} title={`${d.dstr}${d.sched ? ` · ${d.done}/${d.sched} habits` : " · nothing scheduled"}`}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 9, color: d.isToday ? T1 : T3, fontWeight: d.isToday ? 700 : 400 }}>{d.letter}</span>
                  <span style={{ width: 15, height: 15, borderRadius: "50%",
                    background: fill ? col : d.state === "missed" ? "transparent" : `${col}22`,
                    border: `1.5px solid ${d.state === "future" ? BD : col + (fill ? "" : "66")}`,
                    opacity: d.state === "future" ? 0.4 : 1,
                    boxShadow: d.isToday ? `0 0 0 2px ${CY}55` : "none" }} />
                </div>
              );
            })}
          </div>
          {weekXp > 0 && (
            <div style={{ minWidth: 96, textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: AM, fontFamily: "'JetBrains Mono',monospace" }}>+{weekXp.toLocaleString()}</div>
              <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>XP this week</div>
            </div>
          )}
        </Card>
      )}

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
        <ModuleCard color={OR} icon={<Target size={15} color={OR} />} title="Goals" onClick={() => onNavigate("journey")}
          main={gsum.closest ? `${goalPct(gsum.closest)}%` : gsum.active.length ? `${gsum.avgPct}%` : "—"}
          mainLabel={gsum.closest ? gsum.closest.name : "Set a goal in any life area"}
          sub={gsum.active.length ? `${gsum.active.length} active · avg ${gsum.avgPct}%` : "Fitness, trading, faith, reading…"}
          extra={gsum.closest ? areaOf(gsum.closest.area).icon : "🎯"} extraColor={OR} />
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
                    <Meter pct={(v / target) * 100} height={4} color={h.color} style={{ width: 90 }} />
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

      {/* ── Trends & analytics — folded away until asked for ── */}
      <Collapse id="dash_trends" title="Trends & Analytics" sub="Discipline · momentum · consistency — open when you want the long view" defaultOpen={false}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
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
                  <Meter pct={Math.round(d.ratio * 100)} height={3.5} color={d.ratio >= 0.7 ? GR : d.ratio >= 0.4 ? AM : RE} />
                </div>
              ))}
            </Card>

            <Card style={{ padding: "18px 20px" }}>
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
            </Card>

            <Card style={{ padding: "16px 18px" }}>
              <SH title="Progression" sub="Weekly habit consistency" action={<Flame size={13} color={AM} />} />
              <ResponsiveContainer width="100%" height={120}>
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

          <Card style={{ padding: "16px 18px" }}>
            <SH title="Unified Consistency" sub="Every meaningful action across every OS — 13 weeks" action={
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T2 }}><ActivityIcon size={11} color={CY} />{activeDays} active days</span>
            } />
            <ActivityHeatmap counts={activityCounts} weeks={13} color={CY} />
          </Card>

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
      </Collapse>
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
