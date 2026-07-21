// ── Command Center — the executive cockpit ──────────────────────────
// Precision over information. One screen, glanceable in 3–5 seconds: a
// single primary mission, only the alerts that need attention, and a tight
// row of status cards — each answering ONE question. Empty cards hide
// themselves; nothing decorative, no paragraphs, no duplicate numbers.
import { useState, useEffect, useMemo } from "react";
import {
  Target, AlertTriangle, Flame, Trophy, CalendarClock, DollarSign,
  TrendingUp, HeartPulse, ChevronRight, Check,
} from "lucide-react";
import { BD, T1, T2, T3, GL, B2, AC, AC2, GR, AM, RE } from "../../shared/designTokens.js";
import { Card, Hydrating } from "../../shared/ui.jsx";
import { Ring } from "../../shared/charts.jsx";
import { useCountUp } from "../../shared/useCountUp.js";

const GOLD = "#F0B429"; // reserved for the perfect-day hero only
import { useStorageState } from "../../shared/useStorageState.js";
import { getActiveKillzone, getEATTimeStr } from "../trading/timezone.js";
import { getStats, tradingMetrics } from "../trading/helpers.js";
import { sanitizeTrades as sanitizeTiTrades, sanitizeAccounts as sanitizeTiAccounts, netPnl as tiNetPnl } from "../trading/intel/tradingIntel.js";
import { financeSummary } from "../finance/summary.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import {
  isScheduled, isDone, isNonNeg, isWellness, isWeekly, valueOn, currentStreak,
} from "../../shared/habitEngine.js";
import { buildNudges } from "../../shared/insights.js";
import { buildDirective, isRestDay } from "../../shared/directive.js";
import { freedomMath } from "../../shared/freedom.js";
import { scalingGate } from "../../shared/firm.js";
import {
  sanitizeNutrition, dayEntries, dayTotals, calcTargets, healthyStreaks,
} from "../athlete/nutrition.js";
import { sanitizePurity } from "../life/purity.js";
import { getGcalConfig, todaysEvents } from "../../shared/gcal.js";
import { useConsistencyStart, consistencyStats, totalActivities } from "../../shared/consistency.js";

const kes0 = (n) => Math.round(+n || 0).toLocaleString();
// isRestDay comes from directive.js (indexed against WEEK_PLAN, MON→SUN) —
// the old local copy compared "Monday" to "MON" and never matched.

// ── Small shared pieces ──────────────────────────────────────────────
const SectionLabel = ({ icon, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, fontWeight: 700, color: T3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 9 }}>
    {icon}{children}
  </div>
);

function StatCard({ onClick, children, style }) {
  return (
    <Card onClick={onClick}
      style={{ padding: "15px 17px", background: "#121212", cursor: onClick ? "pointer" : "default", transition: "border-color .2s ease, transform .15s ease", ...style }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = `${AC}55`; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = BD; } : undefined}>
      {children}
    </Card>
  );
}

const HEALTH = { good: GR, low: AM, bad: RE };
const DTONE = { urgent: AC, info: AM, good: GR }; // directive rail colour by tone

export function Dashboard({ onNavigate, onOpenReview, habits: habitsV2, setHabits, loaded = true, xp }) {
  const [kz, setKz] = useState(getActiveKillzone);
  const [, setEatTime] = useState(getEATTimeStr);
  const [trades] = useStorageState("ict_trades", []);
  const [tiTrades] = useStorageState("ti_trades", []);
  const [tiAccounts] = useStorageState("ti_accounts", []);
  const [tiSettings] = useStorageState("ti_settings", {});
  const [rawBal] = useStorageState("ict_balance", 15000);
  const bal = Number.isFinite(+rawBal) && +rawBal > 0 ? +rawBal : 15000;
  const [workouts] = useStorageState("athlete_workouts", []);
  const [finance] = useStorageState("finance_state", DEFAULT_FINANCE_STATE);
  const [entries] = useStorageState("journal_entries", []);
  const [rawReviews] = useStorageState("ict_reviews", []);
  const [purity] = useStorageState("purity_log", {});
  const [nutritionLog] = useStorageState("nutrition_log", {});
  const [nutritionProfile] = useStorageState("nutrition_profile", null);
  const [verses] = useStorageState("faith_scripture", []);
  const [decisions] = useStorageState("mind_decisions", []);
  const [firmConfig] = useStorageState("firm_config", null);
  const [firmWithdrawals] = useStorageState("firm_withdrawals", []);
  const [logins] = useStorageState("xp_logins", {});
  const { start: consistencyStart } = useConsistencyStart(logins);
  // `xp`'s memo only recomputes when a watched store changes — with zero
  // interaction across a passive midnight the Day N counter would otherwise
  // freeze on yesterday's value, so it gets the same live tick as the clock.
  const [nowDs, setNowDs] = useState(localDateStr);

  useEffect(() => {
    const t = setInterval(() => { setKz(getActiveKillzone()); setEatTime(getEATTimeStr()); setNowDs(localDateStr()); }, 30000);
    return () => clearInterval(t);
  }, []);

  const ds = localDateStr();
  const cs = useMemo(() => consistencyStats(xp.byDay || {}, consistencyStart, nowDs), [xp.byDay, consistencyStart, nowDs]);
  const totalAct = totalActivities(xp.stats);
  const consistencySentence = cs.currentStreak === 0
    ? "A new day is always available. Show up once — that's the whole game."
    : cs.currentStreak >= cs.longestStreak && cs.currentStreak >= 7
    ? `${cs.currentStreak} days and counting — this is your longest run yet.`
    : "Progress continues. Recovery matters more than perfection.";
  const active = useMemo(() => habitsV2.filter((h) => !h.archived && !h.paused), [habitsV2]);
  const entriesSafe = useMemo(() => (Array.isArray(entries) ? entries : []).filter((e) => e && e.id), [entries]);
  const nutrition = useMemo(() => sanitizeNutrition(nutritionLog), [nutritionLog]);
  const nTargets = useMemo(() => calcTargets(nutritionProfile), [nutritionProfile]);
  const mealsOn = (d) => dayEntries(nutrition, d).length;
  const journaledOn = (d) => entriesSafe.some((e) => (e.date || "").slice(0, 10) === d);
  const workoutOn = (d) => workouts.some((w) => w.date === d);

  // ── 🎯 PRIMARY FOCUS: today's non-negotiables (fall back to all habits) ──
  const mission = useMemo(() => {
    const nn = active.filter((h) => isNonNeg(h) && !isWeekly(h) && isScheduled(h, ds));
    const src = nn.length ? nn : active.filter((h) => isScheduled(h, ds));
    const done = src.filter((h) => isDone(h, ds)).length;
    const total = src.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { label: nn.length ? "Non-Negotiables" : "Today's Habits", done, total, pct, left: total - done };
  }, [active, ds]);
  const xpToNext = xp ? Math.max(0, xp.nextLevelXp - xp.total) : 0;
  const estMin = mission.left * 12; // gentle estimate: ~12 min per remaining commitment

  // ── 📈 DAILY SCORE (Life Score): one composite %, vs yesterday ──
  const dayScore = (d) => {
    const parts = [];
    const sched = active.filter((h) => isScheduled(h, d));
    if (sched.length) parts.push(sched.filter((h) => isDone(h, d)).length / sched.length);
    parts.push(workoutOn(d) || isRestDay(d) ? 1 : 0);
    parts.push(mealsOn(d) > 0 ? 1 : 0);
    parts.push(journaledOn(d) ? 1 : 0);
    return parts.length ? Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 100) : 0;
  };
  const lifeScore = useMemo(() => dayScore(ds), [active, workouts, nutrition, entriesSafe, ds]);
  const yestScore = useMemo(() => dayScore(daysAgoStr(1)), [active, workouts, nutrition, entriesSafe, ds]);
  const scoreDelta = lifeScore - yestScore;

  // ── 🧭 THE DIRECTIVE: the single most important thing to do now, ranked
  //    across every domain, with a reason. The coach on top of the mirror. ──
  const directive = useMemo(
    () => buildDirective({ habits: habitsV2, trades, reviews: rawReviews, bills: finance.bills, workouts, ds, mission, scoreDelta }),
    [habitsV2, trades, rawReviews, finance.bills, workouts, ds, mission, scoreDelta]
  );

  // ── ⚠️ PRIORITY ALERTS: the urgent nudges only, max 3 (minus any the
  //    directive already voices, so the coach line never echoes the list) ──
  const alerts = useMemo(() => {
    const all = buildNudges({ habits: habitsV2, trades, reviews: rawReviews, bills: finance.bills, verses, decisions, purity, nutrition: nutritionLog, nutritionProfile, entries: entriesSafe });
    const hide = directive.suppress || [];
    return all.filter((n) => n.tone === "urgent" && !hide.some((p) => n.id.startsWith(p))).slice(0, 3);
  }, [habitsV2, trades, rawReviews, finance.bills, verses, decisions, purity, nutritionLog, nutritionProfile, directive]);

  // ── 🔥 STREAKS: strongest four, across habits + derived domains ──
  const streaks = useMemo(() => {
    const out = active
      .map((h) => ({ icon: h.icon || "✅", label: h.name, days: currentStreak(h) }))
      .filter((s) => s.days >= 2);
    // Workout streak (today pending never breaks it).
    let wo = 0;
    for (let i = 0; i < 400; i++) { const d = daysAgoStr(i); if (workoutOn(d)) wo++; else if (i > 0) break; }
    if (wo >= 2) out.push({ icon: "🏋️", label: "Workouts", days: wo });
    // Clean-eating streak.
    const hs = healthyStreaks(nutrition, nTargets, ds).current;
    if (hs >= 2) out.push({ icon: "🥗", label: "Nutrition", days: hs });
    // Purity / clean-days streak.
    const pl = sanitizePurity(purity);
    let cl = 0;
    for (let i = 0; i < 800; i++) { const d = daysAgoStr(i); if (pl[d]?.s === "pure") cl++; else if (i > 0 || pl[d]) break; }
    if (cl >= 2) out.push({ icon: "🌿", label: "Purity", days: cl });
    return out.sort((a, b) => b.days - a.days).slice(0, 4);
  }, [active, workouts, nutrition, nTargets, purity, ds]);

  // ── 🏆 XP: level, progress, next reward (nearest journey milestone) ──
  const nextReward = useMemo(() => {
    if (!xp?.journeys) return null;
    const cand = xp.journeys.filter((j) => j.next).sort((a, b) => (a.next.threshold - a.value) - (b.next.threshold - b.value))[0];
    return cand ? `${cand.icon} ${cand.next.rank} · ${cand.name}` : "All journeys complete 👑";
  }, [xp]);

  // ── 📅 SCHEDULE: upcoming calendar events only ──
  const [agenda, setAgenda] = useState({ state: getGcalConfig() ? "loading" : "off", events: [] });
  useEffect(() => {
    if (!getGcalConfig()) return;
    let cancelled = false;
    todaysEvents(false).then((events) => { if (!cancelled) setAgenda({ state: "ok", events }); }).catch(() => { if (!cancelled) setAgenda({ state: "off", events: [] }); });
    return () => { cancelled = true; };
  }, []);
  const upcoming = useMemo(() => {
    const now = Date.now();
    return (agenda.events || []).filter((e) => e.start && new Date(e.start).getTime() >= now - 60000).slice(0, 4);
  }, [agenda]);

  // ── 💰 FINANCE: today's income + net worth (the glanceable figures) ──
  const fin = useMemo(() => financeSummary(finance), [finance]);
  const incomeToday = useMemo(
    () => (Array.isArray(finance.income) ? finance.income : []).filter((e) => e && (e.date || "").slice(0, 10) === ds).reduce((s, e) => s + (+e.amount || 0), 0),
    [finance.income, ds]
  );

  // ── 📊 TRADING: only on an active session or a day with trades ──
  const tMetrics = useMemo(() => tradingMetrics(trades, bal, finance.tradingWithdrawals || 0, finance.profitSplit || 80), [trades, bal, finance.tradingWithdrawals, finance.profitSplit]);
  const tradesToday = useMemo(() => trades.filter((t) => (t.date || "").slice(0, 10) === ds && !t.archived), [trades, ds]);
  const tStats = useMemo(() => getStats(trades), [trades]);
  // New Trading Intelligence journal — today's activity on the active account,
  // blended into the snapshot so the Command Centre reflects the live system.
  const tiToday = useMemo(() => {
    const activeId = tiSettings?.activeAccountId || sanitizeTiAccounts(tiAccounts).find((a) => !a.archived)?.id || "";
    const todays = sanitizeTiTrades(tiTrades).filter((t) => !t.archived && t.date === ds && t.status === "CLOSED" && (!activeId || t.accountId === activeId));
    return { count: todays.length, pnl: todays.reduce((s, t) => s + tiNetPnl(t), 0) };
  }, [tiTrades, tiAccounts, tiSettings, ds]);
  const tradeCountToday = tradesToday.length + tiToday.count;
  const dailyPnlAll = tMetrics.dailyPnl + tiToday.pnl;
  const isTradingDay = kz.active || tradeCountToday > 0;
  const checklistOk = tradesToday.length > 0 && tradesToday.every((t) => +t.checklistTotal > 0 && (+t.checklistScore || 0) >= +t.checklistTotal);

  // ── ❤️ SYSTEM HEALTH: four simple indicators, no percentages ──
  const health = useMemo(() => {
    const sleepH = active.find((h) => isWellness(h) && /sleep/i.test(h.name || ""));
    const waterH = active.find((h) => isWellness(h) && /hydra|water/i.test(h.name || ""));
    const sleepV = sleepH ? valueOn(sleepH, ds) : null;
    const sleepMin = sleepH?.wellnessMin || 7.5;
    const sleep = sleepV == null ? "bad" : sleepV >= sleepMin ? "good" : sleepV > 0 ? "low" : "bad";
    const waterV = waterH ? valueOn(waterH, ds) : null;
    const waterT = waterH?.target || 2;
    const hydration = waterV == null ? "bad" : waterV >= waterT ? "good" : waterV >= waterT * 0.5 ? "low" : "bad";
    const t = dayTotals(dayEntries(nutrition, ds));
    const kcalPct = nTargets.kcal ? t.kcal / nTargets.kcal : 0;
    const calories = mealsOn(ds) === 0 ? "bad" : kcalPct >= 0.8 && kcalPct <= 1.15 ? "good" : "low";
    // Recovery: rest day or good sleep after training → good; otherwise moderate.
    const recovery = (sleep === "good" && (isRestDay(ds) || workoutOn(ds))) ? "good" : sleep === "bad" ? "bad" : "low";
    const word = { good: "Good", low: "Low", bad: "Poor" };
    const rword = { good: "Excellent", low: "Moderate", bad: "Low" };
    return [
      { label: "Sleep", state: sleep, word: word[sleep] },
      { label: "Hydration", state: hydration, word: hydration === "good" ? "On track" : word[hydration] },
      { label: "Calories", state: calories, word: calories === "good" ? "On track" : calories === "low" ? "Off target" : "Unlogged" },
      { label: "Recovery", state: recovery, word: rword[recovery] },
    ];
  }, [active, nutrition, nTargets, workouts, ds]);

  // ── 🎯 THE MISSION + the two pillars (Batman / Stark) ──
  // The doctrine's north star: freedom by real numbers, and the two builds it
  // rests on — the Man (internal discipline) and the Machine (external firm).
  const freedom = useMemo(() => freedomMath(finance, firmConfig), [finance, firmConfig]);
  const gate = useMemo(() => scalingGate(trades, rawReviews, firmWithdrawals), [trades, rawReviews, firmWithdrawals]);
  const topStreakDays = streaks.length ? streaks[0].days : 0;

  // Animated figures — roll up on load, tick on change.
  const perfect = mission.pct === 100 && mission.total > 0;
  const cuPct = useCountUp(mission.pct);
  const cuScore = useCountUp(lifeScore);
  const cuXp = useCountUp(xp?.total ?? 0);
  const cuNet = useCountUp(fin.personalNetWorth);
  const cuPnl = useCountUp(Math.round(tMetrics.dailyPnl));
  const cuFreedom = useCountUp(freedom.freedomPct);

  if (!loaded) return <Hydrating label="Waking the Command Center…" />;

  const big = { fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, color: T1, lineHeight: 1 };
  const dcol = DTONE[directive.tone] || AC;

  const kesShort = (n) => {
    const v = Math.round(+n || 0);
    if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
    if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
    return `${v}`;
  };

  return (
    <div className="cockpit" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1080, margin: "0 auto" }}>

      {/* ── 🗓️ YEAR OF CONSISTENCY — the app-wide showing-up counter ── */}
      <Card style={{ padding: "18px 22px", background: "linear-gradient(110deg,#161616,#0C0C0C)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: AC2, fontWeight: 700 }}>Year of Consistency</span>
            {cs.cycle > 1 && <span style={{ fontSize: 9.5, color: T3 }}>· Cycle {cs.cycle}</span>}
          </div>
          <span style={{ fontSize: 11, color: T3 }}>{cs.daysRemaining} days left this cycle</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: T3 }}>DAY</span>
          <span style={{ fontSize: 44, fontWeight: 900, color: T1, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{cs.dayInCycle}</span>
          <span style={{ fontSize: 13, color: T3 }}>OF 365</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(108px,1fr))", gap: 12, marginBottom: 14 }}>
          {[
            ["Current streak", `${cs.currentStreak}d`, AC],
            ["Longest streak", `${cs.longestStreak}d`, AC2],
            ["Consistency rate", `${cs.consistencyRate}%`, GR],
            ["Total activities", totalAct.toLocaleString(), T1],
            ["This week", `${cs.weeklyCompletion}%`, T1],
            ["This month", `${cs.monthlyCompletion}%`, T1],
          ].map(([l, v, c]) => (
            <div key={l}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
              <div style={{ fontSize: 9, color: T3, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>{consistencySentence}</div>
      </Card>

      {/* ── 🎯 THE MISSION — the freedom north star, above everything ── */}
      <Card style={{ padding: "18px 22px", background: "linear-gradient(110deg,#161616,#0C0C0C)", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
        <Ring pct={freedom.capitalPct} size={104} stroke={9} color={AC}>
          <div style={{ fontSize: 20, ...big, color: AC }}>{cuFreedom}%</div>
          <div style={{ fontSize: 7.5, color: T3, letterSpacing: 1, marginTop: 2 }}>FREEDOM</div>
        </Ring>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: AC, fontWeight: 700 }}>The Mission · Freedom</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T1, marginTop: 3 }}>
            {freedom.yearsOut === 0 ? "The line is crossed." : freedom.yearsOut == null ? "Build the engines." : `≈ ${freedom.yearsOut} years to freedom`}
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 13, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, ...big, color: freedom.freedomPct >= 100 ? GR : T1 }}>KES {kesShort(freedom.passiveMonthly)}<span style={{ fontSize: 10, color: T3, fontWeight: 500 }}> /mo</span></div>
              <div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginTop: 3 }}>Passive · goal {kesShort(freedom.freedomNumber)}</div>
            </div>
            <div>
              <div style={{ fontSize: 15, ...big }}>KES {kesShort(freedom.capital)}</div>
              <div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginTop: 3 }}>Capital · line {kesShort(freedom.target)}</div>
            </div>
          </div>
        </div>
        <button onClick={() => onNavigate("firm")} aria-label="Open The Firm"
          style={{ background: "none", border: `1px solid ${BD}`, borderRadius: 10, padding: "9px 12px", color: T2, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", fontSize: 12 }}>
          The Firm <ChevronRight size={13} />
        </button>
      </Card>

      {/* ── ⚔️ THE MAN · THE MACHINE — the two builds ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        <StatCard onClick={() => onNavigate("life")}>
          <SectionLabel icon={<span style={{ fontSize: 12 }}>🦇</span>}>The Man · Batman</SectionLabel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 34, ...big, color: lifeScore >= 80 ? GR : lifeScore >= 50 ? AM : RE }}>{cuScore}%</span>
            <span style={{ fontSize: 12, color: T2 }}>discipline</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: scoreDelta > 0 ? GR : scoreDelta < 0 ? RE : T3 }}>
              {scoreDelta > 0 ? `↑ +${scoreDelta}%` : scoreDelta < 0 ? `↓ ${scoreDelta}%` : "· even"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T3, marginTop: 6 }}>
            {mission.done}/{mission.total} {mission.label.toLowerCase()} · {topStreakDays > 0 ? `${topStreakDays}-day top streak` : "no streak yet"}
          </div>
        </StatCard>
        <StatCard onClick={() => onNavigate("firm:doctrine")}>
          <SectionLabel icon={<span style={{ fontSize: 12 }}>⚙️</span>}>The Machine · Stark</SectionLabel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 34, ...big, color: gate.met ? GR : T1 }}>{gate.have}<span style={{ fontSize: 15, color: T3 }}>/{gate.need}</span></span>
            <span style={{ fontSize: 12, color: T2 }}>clean months · the gate</span>
          </div>
          <div style={{ fontSize: 11, color: T3, marginTop: 6 }}>
            Fleet ${Math.round(tMetrics.equity).toLocaleString()} · vault KES {kesShort(freedom.capital)}
          </div>
        </StatCard>
      </div>

      {/* ── 🧭 THE DIRECTIVE — one ranked order, above everything ── */}
      <button onClick={() => onNavigate(directive.nav)} aria-label={directive.headline}
        style={{ textAlign: "left", width: "100%", cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 15, padding: "16px 20px",
          background: "linear-gradient(90deg, #151515, #0F0F0F)",
          border: `1px solid ${dcol}33`, borderLeft: `3px solid ${dcol}`, borderRadius: 14, transition: "border-color .2s ease" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${dcol}66`; e.currentTarget.style.borderLeftColor = dcol; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${dcol}33`; e.currentTarget.style.borderLeftColor = dcol; }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{directive.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, letterSpacing: 2.5, textTransform: "uppercase", color: dcol, fontWeight: 700 }}>
            {directive.tone === "good" ? "You're clear" : "Do this first"}
          </div>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: T1, marginTop: 3, lineHeight: 1.25 }}>{directive.headline}</div>
          <div style={{ fontSize: 12, color: T3, marginTop: 3 }}>{directive.why}</div>
          {directive.also && (
            <div style={{ fontSize: 11.5, color: T3, marginTop: 6 }}>
              <span style={{ color: dcol, fontWeight: 700 }}>Then</span> {directive.also}
            </div>
          )}
        </div>
        <ChevronRight size={16} color={T3} style={{ flexShrink: 0 }} />
      </button>

      {/* ── 🎯 PRIMARY FOCUS ── */}
      <Card className={perfect ? "ember" : ""} style={{ padding: "20px 24px", background: "#121212", display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap", borderColor: perfect ? `${GOLD}55` : BD, animation: perfect ? "emberPulse 3.4s ease-in-out infinite" : undefined }}>
        <Ring pct={mission.pct} size={116} stroke={10} color={perfect ? GOLD : AC} glow={perfect}>
          <div style={{ fontSize: 24, ...big, color: perfect ? GOLD : T1 }}>{cuPct}%</div>
        </Ring>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: perfect ? GOLD : AC, fontWeight: 700 }}>Today's Mission</div>
          <div style={{ fontSize: 25, fontWeight: 800, color: T1, marginTop: 4 }}>
            {perfect ? "Mission complete." : `Complete ${mission.done}/${mission.total} ${mission.label}`}
          </div>
          {perfect && <div style={{ fontSize: 13, color: GOLD, marginTop: 4, fontWeight: 600 }}>Nothing left today. Dominate tomorrow. 🔥</div>}
          <div style={{ display: "flex", gap: 26, marginTop: 14, flexWrap: "wrap" }}>
            <div><div style={{ fontSize: 17, ...big, color: AC }}>{xpToNext.toLocaleString()}</div><div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>XP to next level</div></div>
            <div><div style={{ fontSize: 17, ...big }}>{mission.left}</div><div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>Remaining</div></div>
            <div><div style={{ fontSize: 17, ...big }}>{mission.left === 0 ? "—" : `~${estMin}m`}</div><div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>Est. time left</div></div>
          </div>
        </div>
        <button onClick={() => onNavigate("life")} aria-label="Open Life OS"
          style={{ background: "none", border: `1px solid ${BD}`, borderRadius: 10, padding: "9px 12px", color: T2, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", fontSize: 12 }}>
          Open <ChevronRight size={13} />
        </button>
      </Card>

      {/* ── ⚠️ PRIORITY ALERTS (hidden when clear) ── */}
      {alerts.length > 0 && (
        <div>
          <SectionLabel icon={<AlertTriangle size={12} color={AM} />}>Priority Alerts</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => (
              <button key={a.id} onClick={() => onNavigate(a.nav)}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", background: "#121212", border: `1px solid ${AM}33`, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
                <span style={{ fontSize: 15 }}>{a.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: T1 }}>{a.text}</span>
                <ChevronRight size={14} color={T3} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 🏆 XP / PROGRESSION (Life Score now lives in The Man pillar) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        <StatCard onClick={() => onNavigate("journey")}>
          <SectionLabel icon={<Trophy size={12} color={AC} />}>Progression</SectionLabel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 30, ...big }}>Level {xp?.level ?? 1}</span>
          </div>
          <div style={{ fontSize: 12, color: T2, fontFamily: "monospace", marginTop: 6 }}>{cuXp.toLocaleString()} / {(xp?.nextLevelXp ?? 100).toLocaleString()} XP</div>
          <div style={{ height: 4, background: BD, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${xp?.pctToNext ?? 0}%`, background: AC, borderRadius: 2 }} />
          </div>
          {nextReward && <div style={{ fontSize: 10.5, color: T3, marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Next: <span style={{ color: T2 }}>{nextReward}</span></div>}
        </StatCard>
      </div>

      {/* ── 🔥 STREAKS (hidden when none) ── */}
      {streaks.length > 0 && (
        <div>
          <SectionLabel icon={<Flame size={12} color={AC} />}>Current Streaks</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(streaks.length, 4)},1fr)`, gap: 10 }}>
            {streaks.map((s) => (
              <StatCard key={s.label} onClick={() => onNavigate("life")} style={{ padding: "13px 14px" }}>
                <div style={{ fontSize: 17 }}>{s.icon}</div>
                <div style={{ fontSize: 22, ...big, marginTop: 6 }}>{s.days}<span style={{ fontSize: 11, color: T3, fontWeight: 500 }}> days</span></div>
                <div style={{ fontSize: 11, color: T2, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
              </StatCard>
            ))}
          </div>
        </div>
      )}

      {/* ── 📅 SCHEDULE · 💰 FINANCE · 📊 TRADING (each hides when empty) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        {upcoming.length > 0 && (
          <StatCard>
            <SectionLabel icon={<CalendarClock size={12} color={AC} />}>Up Next</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {upcoming.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11.5, color: AC, fontFamily: "monospace", width: 64, flexShrink: 0 }}>{e.allDay ? "all-day" : e.time}</span>
                  <span style={{ fontSize: 13, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                </div>
              ))}
            </div>
          </StatCard>
        )}

        {(incomeToday > 0 || fin.personalNetWorth !== 0) && (
          <StatCard onClick={() => onNavigate("firm:wealth")}>
            <SectionLabel icon={<DollarSign size={12} color={AC} />}>Finance</SectionLabel>
            <div style={{ fontSize: 28, ...big, color: fin.personalNetWorth >= 0 ? T1 : RE }}>KES {kes0(cuNet)}</div>
            <div style={{ fontSize: 10.5, color: T3, marginTop: 3 }}>Net worth</div>
            {incomeToday > 0 && <div style={{ fontSize: 12, color: GR, marginTop: 8 }}>+KES {kes0(incomeToday)} income today</div>}
          </StatCard>
        )}

        {isTradingDay && (
          <StatCard onClick={() => onNavigate("firm:trading")} style={{ borderColor: kz.active ? `${AC}44` : BD }}>
            <SectionLabel icon={<TrendingUp size={12} color={AC} />}>Trading{kz.active ? " · Live" : ""}</SectionLabel>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 26, ...big, color: dailyPnlAll > 0 ? GR : dailyPnlAll < 0 ? RE : T1 }}>
                {dailyPnlAll >= 0 ? "+" : "−"}${Math.abs(cuPnl + tiToday.pnl).toLocaleString()}
              </span>
              <span style={{ fontSize: 11, color: T3 }}>today</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 9, fontSize: 11.5, color: T2 }}>
              <span>{tradeCountToday} trade{tradeCountToday === 1 ? "" : "s"}</span>
              {tradesToday.length > 0 && (
                <span style={{ color: checklistOk ? GR : AM, display: "flex", alignItems: "center", gap: 4 }}>
                  {checklistOk ? <><Check size={11} /> Checklist</> : "Checklist gaps"}
                </span>
              )}
            </div>
          </StatCard>
        )}
      </div>

      {/* ── ❤️ SYSTEM HEALTH ── */}
      <div>
        <SectionLabel icon={<HeartPulse size={12} color={AC} />}>System Health</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {health.map((h) => (
            <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", background: "#121212", border: `1px solid ${BD}`, borderRadius: 12 }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: HEALTH[h.state], boxShadow: `0 0 8px ${HEALTH[h.state]}66`, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{h.label}</div>
                <div style={{ fontSize: 11, color: T3 }}>{h.word}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 📅 WEEK IN REVIEW — the reflective bookend ── */}
      {onOpenReview && (
        <button onClick={onOpenReview} aria-label="Open Week in Review"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "none", border: `1px dashed ${BD}`, borderRadius: 12, padding: "12px 0", color: T3, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", transition: "border-color .2s ease, color .2s ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${AC}66`; e.currentTarget.style.color = T2; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = BD; e.currentTarget.style.color = T3; }}>
          📅 Week in Review
        </button>
      )}
    </div>
  );
}
