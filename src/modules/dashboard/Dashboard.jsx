// ── Command Centre — the executive cockpit ──────────────────────────
// One screen, glanceable in 3–5 seconds. The layout follows the "Command
// Centre" design: a campaign strip (Day N of 365), the level, this week's
// focus, a God-Mode hero with a nine-day sparkline, and a tight grid of
// domain cards — each answering ONE question, each carrying a left accent
// stripe that reads its state at a glance. The doctrine depth (freedom
// mission, the two pillars, finance/trading, system health) folds away so
// the daily view stays a glance; everything is one tap down.
import { useState, useEffect, useMemo } from "react";
import {
  Target, AlertTriangle, Flame, Trophy, CalendarClock, DollarSign,
  TrendingUp, HeartPulse, ChevronRight, Check, Crosshair,
  ListChecks, CandlestickChart, Dumbbell, BookOpen, Sparkles, Gauge,
} from "lucide-react";
import { BD, T1, T2, T3, GL, B2, AC, AC2, GR, AM, RE, MONO } from "../../shared/designTokens.js";
import { Card, Hydrating } from "../../shared/ui.jsx";
import { TodayTrackers } from "../../shared/TodayTrackers.jsx";
import { billsDueSoon } from "../finance/bills.js";
import { Ring } from "../../shared/charts.jsx";

import { useStorageState } from "../../shared/useStorageState.js";
import { habitSummary } from "../habits/summary.js";
import { getActiveKillzone, getEATTimeStr } from "../trading/timezone.js";
import { sanitizeTrades as sanitizeTiTrades, sanitizeAccounts as sanitizeTiAccounts, netPnl as tiNetPnl, accountMetrics as tiAccountMetrics } from "../trading/intel/tradingIntel.js";
import { financeSummary } from "../finance/summary.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
// Habit facts now come from the new tracker via habitSummary; only the legacy
// wellness helpers (sleep/water numeric habits) remain from the old engine.
import { isWellness, valueOn } from "../../shared/habitEngine.js";
import { buildNudges } from "../../shared/insights.js";
import { buildDirective, isRestDay } from "../../shared/directive.js";
import { useDayMarks } from "../../shared/dayMarks.js";
import { consistencyOpts } from "../../shared/consistencyOpts.js";
import { freedomMath } from "../../shared/freedom.js";
import { MotivePush } from "../../shared/MotivePush.jsx";
import { FocusToday } from "../../shared/FocusToday.jsx";
import { OverheadToday } from "../../shared/OverheadToday.jsx";
import { scalingGate } from "../../shared/firm.js";
import {
  sanitizeNutrition, dayEntries, dayTotals, calcTargets, healthyStreaks,
} from "../athlete/nutrition.js";
import { sanitizePurity } from "../life/purity.js";
import { getGcalConfig, todaysEvents } from "../../shared/gcal.js";
import { useConsistencyStart, consistencyStats, totalActivities } from "../../shared/consistency.js";

const kes0 = (n) => Math.round(+n || 0).toLocaleString();

// ── Small shared pieces ──────────────────────────────────────────────
const SectionLabel = ({ icon, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, fontWeight: 700, color: T3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 9 }}>
    {icon}{children}
  </div>
);

function StatCard({ onClick, children, style }) {
  return (
    <Card onClick={onClick}
      style={{ padding: "15px 17px", background: B2, cursor: onClick ? "pointer" : "default", transition: "border-color .2s ease, transform .15s ease", ...style }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = `${AC}55`; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = BD; } : undefined}>
      {children}
    </Card>
  );
}

const HEALTH = { good: GR, low: AM, bad: RE };
const DTONE = { urgent: AC, info: AM, good: GR }; // directive rail colour by tone

// ── Command Centre building blocks ───────────────────────────────────
const UP = { fontSize: 9, letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 700 };
const ACCENT = { g: AC, ok: GR, bad: RE, off: "#2E2A22" };

// A tappable panel with the shared card frame — the base for the campaign,
// level and hero rows.
function Panel({ onClick, children, style }) {
  const clickable = !!onClick;
  return (
    <div role={clickable ? "button" : undefined} tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{ border: `1px solid ${BD}`, borderRadius: 14, background: B2, cursor: clickable ? "pointer" : "default",
        transition: "border-color .2s ease", ...style }}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.borderColor = `${AC}55`; } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.borderColor = BD; } : undefined}>
      {children}
    </div>
  );
}

// Campaign — Day N of 365, its phase, and the cycle progress bar.
function Campaign({ day, pct, phase, remaining, cycle, onClick }) {
  return (
    <Panel onClick={onClick} style={{ padding: "13px 16px", background: "linear-gradient(150deg,#161310,#0D0C0A 70%)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T1, letterSpacing: -0.2 }}>Day {day}</span>
        <span style={{ fontSize: 11, color: T3 }}>of 365{cycle > 1 ? ` · Cycle ${cycle}` : ""}</span>
        <span style={{ ...UP, marginLeft: "auto", fontSize: 8.5, color: AC, border: `1px solid ${AC}44`, padding: "2px 7px", borderRadius: 5 }}>{phase}</span>
      </div>
      <div style={{ height: 5, background: "#241F18", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: 5, width: `${pct}%`, borderRadius: 3, background: `linear-gradient(90deg,${AC2}88,${AC})` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 9.5, color: T3 }}>{pct}% complete</span>
        <span style={{ fontSize: 9.5, color: T3 }}>{remaining} days remaining</span>
      </div>
    </Panel>
  );
}

// Level — the circular badge, title, XP bar and the next rung.
function LevelCard({ level, title, xp, nextXp, pct, toNext, onClick }) {
  return (
    <Panel onClick={onClick} style={{ padding: "13px 15px", display: "flex", alignItems: "center", gap: 13 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${AC}`,
        background: "radial-gradient(circle at 35% 30%,#2A2113,#141110)", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1, color: AC, fontFamily: MONO }}>{level}</span>
        <span style={{ ...UP, fontSize: 7, color: T3, marginTop: 1 }}>LVL</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T1 }}>{title}</span>
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: T3, fontFamily: MONO }}>{xp.toLocaleString()} / {nextXp.toLocaleString()} XP</span>
        </div>
        <div style={{ height: 5, background: "#241F18", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: 5, width: `${pct}%`, borderRadius: 3, background: AC }} />
        </div>
        <div style={{ fontSize: 9.5, color: T3, marginTop: 5 }}>{toNext.toLocaleString()} XP to Level {level + 1}</div>
      </div>
    </Panel>
  );
}

// God Mode — today's composite discipline score, its delta vs the running
// nine-day average, and a sparkline of those days.
function GodMode({ pct, delta, spark, xpToday, onClick }) {
  const w = 190, h = 46, n = spark.length;
  const pts = spark.map((v, i) => `${(i / Math.max(1, n - 1)) * w},${h - (Math.max(0, Math.min(100, v)) / 100) * (h - 6) - 3}`).join(" ");
  const last = pts.split(" ").pop().split(",");
  return (
    <Panel onClick={onClick} style={{ padding: 14, display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(150deg,#1A1610,#121110 65%)" }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ ...UP, fontSize: 9, color: T3 }}>God Mode</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: pct >= 80 ? GR : pct >= 50 ? AC : T1, lineHeight: 1.1, fontFamily: MONO }}>
          {pct}<span style={{ fontSize: 14, color: T3, fontWeight: 500 }}>%</span>
        </div>
        <div style={{ fontSize: 10, color: delta > 0 ? GR : delta < 0 ? RE : T3, marginTop: 2 }}>
          {delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${Math.abs(delta)}` : "· even"} vs avg
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={pts} fill="none" stroke={AC} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={last[0]} cy={last[1]} r="2.6" fill={AC} />
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          <span style={{ fontSize: 9, color: xpToday > 0 ? GR : T3 }}>{xpToday > 0 ? `+${xpToday.toLocaleString()} XP today` : "last 9 days"}</span>
          <span style={{ fontSize: 9, color: T3 }}>last 9 days</span>
        </div>
      </div>
    </Panel>
  );
}

// A domain status card — icon + label, one big value, a subline, and an
// optional dot-row or bar. The left stripe encodes state at a glance.
function DomainCard({ icon: Icon, label, accent = "g", value, unit, sub, subTone, dots, bar, xp, onClick }) {
  const col = ACCENT[accent] || AC;
  const subCol = subTone === "good" ? GR : subTone === "bad" ? RE : T3;
  return (
    <div role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      style={{ position: "relative", overflow: "hidden", background: B2, border: `1px solid ${BD}`, borderRadius: 14,
        padding: "12px 13px", cursor: onClick ? "pointer" : "default", transition: "border-color .2s ease" }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.borderColor = `${AC}55`; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.borderColor = BD; } : undefined}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: col }} />
      {xp > 0 && <span style={{ position: "absolute", top: 10, right: 12, fontSize: 8.5, color: AC2, fontFamily: MONO, letterSpacing: 0.2 }}>+{xp} XP</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icon size={13} color={AC} />
        <span style={{ ...UP, fontSize: 9, color: T3, letterSpacing: 0.7 }}>{label}</span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 800, color: T1, lineHeight: 1, letterSpacing: -0.3, fontFamily: MONO }}>
        {value}{unit ? <span style={{ fontSize: 11, color: T3, fontWeight: 400, fontFamily: MONO }}> {unit}</span> : null}
      </div>
      {sub != null && <div style={{ fontSize: 10, color: subCol, marginTop: 5 }}>{sub}</div>}
      {dots && (
        <div style={{ display: "flex", gap: 2.5, marginTop: 8 }}>
          {dots.map((on, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: on ? AC : "#241F18" }} />)}
        </div>
      )}
      {bar != null && (
        <div style={{ height: 3, background: "#241F18", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
          <div style={{ height: 3, width: `${Math.max(0, Math.min(100, bar))}%`, borderRadius: 2, background: AC }} />
        </div>
      )}
    </div>
  );
}

export function Dashboard({ onNavigate, onOpenReview, habits: habitsV2, setHabits, loaded = true, xp }) {
  const [kz, setKz] = useState(getActiveKillzone);
  const [, setEatTime] = useState(getEATTimeStr);
  const [clock, setClock] = useState(() => new Date());
  const [trades] = useStorageState("ict_trades", []); // legacy — checklist indicator only
  const [tiTrades] = useStorageState("ti_trades", []);
  const [tiAccounts] = useStorageState("ti_accounts", []);
  const [tiSettings] = useStorageState("ti_settings", {});
  const [workouts] = useStorageState("athlete_workouts", []);
  const [dayMarks] = useDayMarks();
  const restDays = dayMarks.rest, cheatDays = dayMarks.cheat;
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
  const [freezes] = useStorageState("streak_freezes", { frozen: [] });
  const [htHabits] = useStorageState("ht_habits", []);
  const [htEntries] = useStorageState("ht_entries", []);
  const [moreOpen, setMoreOpen] = useStorageState("dash_show_more", false);
  const { start: consistencyStart } = useConsistencyStart(logins);
  const [nowDs, setNowDs] = useState(localDateStr);

  useEffect(() => {
    const t = setInterval(() => { setKz(getActiveKillzone()); setEatTime(getEATTimeStr()); setNowDs(localDateStr()); setClock(new Date()); }, 30000);
    return () => clearInterval(t);
  }, []);

  const ds = localDateStr();
  const csOpts = useMemo(
    () => consistencyOpts({ habits: habitsV2, marks: dayMarks, freezes, lifeDays: xp.lifeDays, fitnessDays: xp.fitnessDays }),
    [habitsV2, dayMarks, freezes, xp.lifeDays, xp.fitnessDays]
  );
  const cs = useMemo(() => consistencyStats(xp.byDay || {}, consistencyStart, nowDs, csOpts), [xp.byDay, consistencyStart, nowDs, csOpts]);
  const totalAct = totalActivities(xp.stats);
  const consistencySentence = cs.currentStreak === 0
    ? "A new day is always available. Show up once — that's the whole game."
    : cs.currentStreak >= cs.longestStreak && cs.currentStreak >= 7
    ? `${cs.currentStreak} days and counting — this is your longest run yet.`
    : "Progress continues. Recovery matters more than perfection.";
  const active = useMemo(() => habitsV2.filter((h) => !h.archived && !h.paused), [habitsV2]);
  // The new habit tracker (ht_* stores), summarised through its own logic so
  // the dashboard's streaks and today's-habits counts match its detail screens.
  const hsum = useMemo(() => habitSummary(htHabits, htEntries, ds), [htHabits, htEntries, ds]);
  const entriesSafe = useMemo(() => (Array.isArray(entries) ? entries : []).filter((e) => e && e.id), [entries]);
  const nutrition = useMemo(() => sanitizeNutrition(nutritionLog), [nutritionLog]);
  const nTargets = useMemo(() => calcTargets(nutritionProfile), [nutritionProfile]);

  const mealsOn = (d) => dayEntries(nutrition, d).length;
  const journaledOn = (d) => entriesSafe.some((e) => (e.date || "").slice(0, 10) === d);
  const workoutOn = (d) => workouts.some((w) => w.date === d);
  const tradedOn = (d) => trades.some((t) => (t.date || "").slice(0, 10) === d && !t.archived);

  // ── 🎯 Today's habits (the primary commitment count) ──
  const mission = useMemo(() => {
    const done = hsum.todayDone, total = hsum.todayScheduled;
    const pct = total ? Math.floor((done / total) * 100) : 0;
    return { label: "Today's Habits", done, total, pct, left: total - done };
  }, [hsum]);
  const xpToNext = xp ? Math.max(0, xp.nextLevelXp - xp.total) : 0;

  // ── 📈 Life Score: one composite %, and the nine-day trail ──
  const dayScore = (d) => {
    const parts = [];
    const hr = hsum.ratioOn(d);
    if (hr != null) parts.push(hr);
    parts.push(mealsOn(d) > 0 ? 1 : 0);
    parts.push(journaledOn(d) ? 1 : 0);
    return parts.length ? Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 100) : 0;
  };
  const lifeScore = useMemo(() => dayScore(ds), [hsum, workouts, nutrition, entriesSafe, ds]);
  const yestScore = useMemo(() => dayScore(daysAgoStr(1)), [hsum, workouts, nutrition, entriesSafe, ds]);
  const scoreDelta = lifeScore - yestScore;
  const spark = useMemo(() => Array.from({ length: 9 }, (_, i) => dayScore(daysAgoStr(8 - i))), [hsum, nutrition, entriesSafe, ds]);
  const godAvg = spark.length ? Math.round(spark.reduce((s, x) => s + x, 0) / spark.length) : 0;
  const godDelta = lifeScore - godAvg;

  // ── 🧭 THE DIRECTIVE — the single most important thing to do now ──
  const directive = useMemo(
    () => buildDirective({ habits: habitsV2, trades, reviews: rawReviews, bills: finance.bills, workouts, restDays, ds, mission, scoreDelta }),
    [habitsV2, trades, rawReviews, finance.bills, workouts, restDays, ds, mission, scoreDelta]
  );

  // ── ⚠️ PRIORITY ALERTS — urgent nudges only, minus what the directive says ──
  const alerts = useMemo(() => {
    const all = buildNudges({ habits: habitsV2, trades, reviews: rawReviews, bills: finance.bills, verses, decisions, purity, nutrition: nutritionLog, nutritionProfile, entries: entriesSafe });
    const hide = directive.suppress || [];
    return all.filter((n) => n.tone === "urgent" && !hide.some((p) => n.id.startsWith(p))).slice(0, 3);
  }, [habitsV2, trades, rawReviews, finance.bills, verses, decisions, purity, nutritionLog, nutritionProfile, directive]);

  // ── 🔥 STREAKS — strongest four, across habits + derived domains ──
  const purityStreak = useMemo(() => {
    const pl = sanitizePurity(purity);
    let cl = 0;
    for (let i = 0; i < 800; i++) { const d = daysAgoStr(i); if (pl[d]?.s === "pure") cl++; else if (i > 0 || pl[d]) break; }
    return cl;
  }, [purity]);
  const streaks = useMemo(() => {
    const out = hsum.streaks.map((s) => ({ icon: s.icon, label: s.label, days: s.days })).filter((s) => s.days >= 2);
    const hs = healthyStreaks(nutrition, nTargets, ds, cheatDays).current;
    if (hs >= 2) out.push({ icon: "🥗", label: "Nutrition", days: hs });
    if (purityStreak >= 2) out.push({ icon: "🌿", label: "Purity", days: purityStreak });
    return out.sort((a, b) => b.days - a.days).slice(0, 4);
  }, [hsum, nutrition, nTargets, purityStreak, cheatDays, ds]);

  // ── 🏆 XP — nearest journey milestone ──
  const nextReward = useMemo(() => {
    if (!xp?.journeys) return null;
    const cand = xp.journeys.filter((j) => j.next).sort((a, b) => (a.next.threshold - a.value) - (b.next.threshold - b.value))[0];
    return cand ? `${cand.icon} ${cand.next.rank} · ${cand.name}` : "All journeys complete 👑";
  }, [xp]);

  // ── 📅 SCHEDULE — upcoming calendar events only ──
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

  // ── 💰 FINANCE ──
  const fin = useMemo(() => financeSummary(finance), [finance]);
  const monthExpenses = useMemo(() => (Array.isArray(finance.bills) ? finance.bills.reduce((s, b) => s + (+b?.amount || 0), 0) : 0), [finance.bills]);
  const incomeToday = useMemo(
    () => (Array.isArray(finance.income) ? finance.income : []).filter((e) => e && (e.date || "").slice(0, 10) === ds).reduce((s, e) => s + (+e.amount || 0), 0),
    [finance.income, ds]
  );

  // ── 📊 TRADING ──
  const fleetEquity = useMemo(
    () => sanitizeTiAccounts(tiAccounts).filter((a) => !a.archived).reduce((s, a) => s + tiAccountMetrics(a, tiTrades).currentBalance, 0),
    [tiAccounts, tiTrades]
  );
  const tradesToday = useMemo(() => trades.filter((t) => (t.date || "").slice(0, 10) === ds && !t.archived), [trades, ds]);
  const tiToday = useMemo(() => {
    const activeId = tiSettings?.activeAccountId || sanitizeTiAccounts(tiAccounts).find((a) => !a.archived)?.id || "";
    const todays = sanitizeTiTrades(tiTrades).filter((t) => !t.archived && t.date === ds && t.status === "CLOSED" && (!activeId || t.accountId === activeId));
    return { count: todays.length, pnl: todays.reduce((s, t) => s + tiNetPnl(t), 0) };
  }, [tiTrades, tiAccounts, tiSettings, ds]);
  const tradeCountToday = tradesToday.length + tiToday.count;
  const isTradingDay = kz.active || tradeCountToday > 0;
  const checklistOk = tradesToday.length > 0 && tradesToday.every((t) => +t.checklistTotal > 0 && (+t.checklistScore || 0) >= +t.checklistTotal);

  // ── ❤️ SYSTEM HEALTH — four indicators ──
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
    const recovery = (sleep === "good" && (isRestDay(ds, restDays) || workoutOn(ds))) ? "good" : sleep === "bad" ? "bad" : "low";
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
  const freedom = useMemo(() => freedomMath(finance, firmConfig), [finance, firmConfig]);
  const gate = useMemo(() => scalingGate(trades, rawReviews, firmWithdrawals), [trades, rawReviews, firmWithdrawals]);
  const topStreakDays = streaks.length ? streaks[0].days : 0;

  if (!loaded) return <Hydrating label="Waking the Command Centre…" />;

  const big = { fontFamily: MONO, fontWeight: 900, color: T1, lineHeight: 1 };
  const dcol = DTONE[directive.tone] || AC;

  const kesShort = (n) => {
    const v = Math.round(+n || 0);
    if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
    if (v >= 1e3) return `${Math.round(v / 1e3)}K`;
    return `${v}`;
  };

  // ── Derived display values for the top rows ──
  const timeStr = clock.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr = clock.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  const phase = cs.dayInCycle <= 121 ? "Phase I · Foundation" : cs.dayInCycle <= 243 ? "Phase II · Momentum" : "Phase III · Mastery";
  const xpToday = xp?.today || 0;

  // ── The domain grid — one card per daily domain, honest state on each ──
  const XPV = { habit: 10, perfectDay: 25, meal: 10, protein: 10, healthy: 15, workout: 30 }; // mirrors xpEngine V (display only)
  const hSched = hsum.todayScheduled, hDone = hsum.todayDone;
  const fuelT = dayTotals(dayEntries(nutrition, ds));
  const kcal = Math.round(fuelT.kcal || 0), prot = Math.round(fuelT.p || 0);
  const proteinHit = nTargets.p ? prot >= nTargets.p : false;
  const fuelHealthy = kcal > 0 && (!nTargets.kcal || (kcal >= nTargets.kcal * 0.8 && kcal <= nTargets.kcal * 1.15));
  const woToday = workouts.find((w) => (w.date || "") === ds);
  const journaledToday = journaledOn(ds);

  const domains = [
    {
      key: "habits", icon: ListChecks, label: "Habits", nav: "habits",
      accent: hSched === 0 ? "off" : hDone >= hSched ? "ok" : "g",
      value: hSched ? `${hDone}` : "—", unit: hSched ? `/ ${hSched}` : "",
      sub: hSched === 0 ? "none scheduled" : hDone >= hSched ? "all done today" : `${hSched - hDone} still due today`,
      subTone: hSched > 0 && hDone >= hSched ? "good" : null,
      dots: hSched ? Array.from({ length: Math.min(hSched, 10) }, (_, i) => i < hDone) : null,
      xp: hDone ? hDone * XPV.habit + (hSched > 0 && hDone >= hSched ? XPV.perfectDay : 0) : 0,
    },
    {
      key: "trading", icon: CandlestickChart, label: "Trading", nav: "firm:trading",
      accent: kz.active ? "g" : "off",
      value: `${tradeCountToday}`, unit: tradeCountToday === 1 ? "trade" : "trades",
      sub: kz.active ? "session live" : "outside killzone", subTone: kz.active ? "good" : null,
      dots: Array.from({ length: 6 }, (_, i) => tradedOn(daysAgoStr(5 - i))),
    },
    {
      key: "fuel", icon: Flame, label: "Fuel", nav: "life",
      accent: kcal > 0 ? "g" : "off",
      value: kcal > 0 ? kcal.toLocaleString() : "—", unit: kcal > 0 ? "kcal" : "",
      sub: nTargets.p ? `protein ${prot} / ${nTargets.p} g` : `${prot} g protein`,
      bar: nTargets.p ? (prot / nTargets.p) * 100 : null,
      xp: kcal > 0 ? XPV.meal + (proteinHit ? XPV.protein : 0) + (fuelHealthy ? XPV.healthy : 0) : 0,
    },
    {
      key: "body", icon: Dumbbell, label: "Body", nav: "gym",
      accent: woToday ? "ok" : isRestDay(ds, restDays) ? "off" : "off",
      value: woToday ? (woToday.type ? woToday.type.replace(/^\w/, (c) => c.toUpperCase()) : "Logged") : isRestDay(ds, restDays) ? "Rest" : "Not yet",
      sub: woToday ? "session logged" : isRestDay(ds, restDays) ? "planned rest" : "nothing yet",
      subTone: woToday ? "good" : null,
      dots: Array.from({ length: 7 }, (_, i) => workoutOn(daysAgoStr(6 - i))),
      xp: woToday ? XPV.workout : 0,
    },
    {
      key: "journal", icon: BookOpen, label: "Journal", nav: "life",
      accent: journaledToday ? "g" : "off",
      value: journaledToday ? "Written" : "Not yet",
      sub: journaledToday ? "entry saved today" : "nothing written yet",
      subTone: journaledToday ? "good" : null,
    },
    {
      key: "purity", icon: Sparkles, label: "Purity", nav: "life",
      accent: purityStreak > 0 ? "g" : "off",
      value: `${purityStreak}`, unit: "clean",
      sub: purityStreak > 0 ? "days in a row" : "log today",
    },
    {
      key: "finance", icon: DollarSign, label: "Wealth", nav: "firm:wealth",
      accent: fin.personalNetWorth >= 0 ? "g" : "bad",
      value: `KES ${kesShort(fin.personalNetWorth)}`,
      sub: incomeToday > 0 ? `+KES ${kesShort(incomeToday)} today` : "net worth", subTone: incomeToday > 0 ? "good" : null,
    },
    {
      key: "streak", icon: Flame, label: "Streak", nav: "journey",
      accent: cs.currentStreak > 0 ? "g" : "off",
      value: `${cs.currentStreak}`, unit: "days",
      sub: `best ${cs.longestStreak} days`,
    },
  ];

  return (
    <div className="cockpit" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 1080, margin: "0 auto" }}>

      {/* ── status subtitle ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T3, margin: "0 2px 2px" }}>
        <Crosshair size={12} color={AC} />
        <span>{dateStr} · {timeStr}</span>
        <span style={{ color: kz.active ? GR : T3 }}>· {kz.active ? "killzone open" : "markets quiet"}</span>
      </div>

      {/* ── campaign · day N of 365 ── */}
      <Campaign day={cs.dayInCycle} pct={cs.cycleCompletionPct} phase={phase} remaining={cs.daysRemaining} cycle={cs.cycle} onClick={() => onNavigate("journey")} />

      {/* ── level ── */}
      <LevelCard level={xp?.level ?? 1} title={xp?.title ?? "Beginner"} xp={xp?.total ?? 0} nextXp={xp?.nextLevelXp ?? 100} pct={xp?.pctToNext ?? 0} toNext={xpToNext} onClick={() => onNavigate("journey")} />

      {/* ── this week's focus (self-hides when none set) ── */}
      <FocusToday />

      {/* ── god mode hero ── */}
      <GodMode pct={lifeScore} delta={godDelta} spark={spark} xpToday={xpToday} onClick={() => onNavigate("life")} />

      <MotivePush context={["day-start", "legendary"].filter((c) => c !== "legendary" || cs.currentStreak >= 100)}
        state={{ streak: cs.currentStreak, missedYesterday: cs.currentStreak === 0, legendary: cs.longestStreak >= 100 && cs.currentStreak === cs.longestStreak }} accent={AC} />

      {/* ── 🧭 THE DIRECTIVE — one ranked order ── */}
      <button onClick={() => onNavigate(directive.nav)} aria-label={directive.headline}
        style={{ textAlign: "left", width: "100%", cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 15, padding: "15px 18px",
          background: "linear-gradient(90deg,#161310,#100F0D)",
          border: `1px solid ${dcol}33`, borderLeft: `3px solid ${dcol}`, borderRadius: 14, transition: "border-color .2s ease" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${dcol}66`; e.currentTarget.style.borderLeftColor = dcol; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${dcol}33`; e.currentTarget.style.borderLeftColor = dcol; }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{directive.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...UP, fontSize: 9.5, letterSpacing: 2.5, color: dcol }}>
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

      {/* ── ⚠️ PRIORITY ALERTS (hidden when clear) ── */}
      {alerts.length > 0 && (
        <div>
          <SectionLabel icon={<AlertTriangle size={12} color={AM} />}>Priority Alerts</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map((a) => (
              <button key={a.id} onClick={() => onNavigate(a.nav)}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", background: B2, border: `1px solid ${AM}33`, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
                <span style={{ fontSize: 15 }}>{a.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: T1 }}>{a.text}</span>
                <ChevronRight size={14} color={T3} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── DOMAINS — the glanceable grid ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: T3, letterSpacing: 1.4, textTransform: "uppercase", margin: "6px 2px 0", fontWeight: 700 }}>
        <Gauge size={12} color={AC} /> Domains
        <span style={{ flex: 1, height: 1, background: BD, marginLeft: 4 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
        {domains.map((d) => (
          <DomainCard key={d.key} icon={d.icon} label={d.label} accent={d.accent} value={d.value} unit={d.unit}
            sub={d.sub} subTone={d.subTone} dots={d.dots} bar={d.bar} xp={d.xp} onClick={() => onNavigate(d.nav)} />
        ))}
      </div>

      <TodayTrackers overheadActual={monthExpenses} />

      {/* ── ▾ THE FULL COCKPIT — doctrine depth, folded by default ── */}
      <button onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen} aria-label={moreOpen ? "Hide the full cockpit" : "Show the full cockpit"}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "none", border: `1px dashed ${BD}`, borderRadius: 12, padding: "12px 0", color: T3, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", transition: "border-color .2s ease, color .2s ease", marginTop: 4 }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${AC}66`; e.currentTarget.style.color = T2; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = BD; e.currentTarget.style.color = T3; }}>
        <ChevronRight size={14} style={{ transform: moreOpen ? "rotate(90deg)" : "none", transition: "transform .2s ease" }} />
        {moreOpen ? "Hide details" : "More — mission · pillars · finance · health"}
      </button>

      {moreOpen && (<>

      {/* ── 🎯 THE MISSION — the freedom north star ── */}
      <Card style={{ padding: "18px 22px", background: "linear-gradient(110deg,#161310,#0C0B0A)", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
        <Ring pct={freedom.capitalPct} size={104} stroke={9} color={AC}>
          <div style={{ fontSize: 20, ...big, color: AC }}>{freedom.freedomPct}%</div>
          <div style={{ fontSize: 7.5, color: T3, letterSpacing: 1, marginTop: 2 }}>FREEDOM</div>
        </Ring>
        <div style={{ flex: 1, minWidth: 230 }}>
          <div style={{ ...UP, fontSize: 10, letterSpacing: 2.5, color: AC }}>The Mission · Freedom</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T1, marginTop: 3 }}>
            {freedom.yearsOut === 0 ? "The line is crossed." : freedom.yearsOut == null ? "Build the engines." : `≈ ${freedom.yearsOut} years to freedom`}
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 13, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, ...big, color: freedom.freedomPct >= 100 ? GR : T1 }}>KES {kesShort(freedom.passiveMonthly)}<span style={{ fontSize: 10, color: T3, fontWeight: 500 }}> /mo</span></div>
              <div style={{ ...UP, fontSize: 9, color: T3, letterSpacing: 1, marginTop: 3 }}>Passive · goal {kesShort(freedom.freedomNumber)}</div>
            </div>
            <div>
              <div style={{ fontSize: 15, ...big }}>KES {kesShort(freedom.capital)}</div>
              <div style={{ ...UP, fontSize: 9, color: T3, letterSpacing: 1, marginTop: 3 }}>Capital · line {kesShort(freedom.target)}</div>
            </div>
          </div>
        </div>
        <button onClick={() => onNavigate("firm")} aria-label="Open The Firm"
          style={{ background: "none", border: `1px solid ${BD}`, borderRadius: 10, padding: "9px 12px", color: T2, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", fontSize: 12 }}>
          The Firm <ChevronRight size={13} />
        </button>
      </Card>

      {/* ── ⚔️ THE MAN · THE MACHINE ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
        <StatCard onClick={() => onNavigate("life")}>
          <SectionLabel icon={<span style={{ fontSize: 12 }}>🦇</span>}>The Man · Batman</SectionLabel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 34, ...big, color: lifeScore >= 80 ? GR : lifeScore >= 50 ? AM : RE }}>{lifeScore}%</span>
            <span style={{ fontSize: 12, color: T2 }}>discipline</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: scoreDelta > 0 ? GR : scoreDelta < 0 ? RE : T3 }}>
              {scoreDelta > 0 ? `↑ +${scoreDelta}%` : scoreDelta < 0 ? `↓ ${scoreDelta}%` : "· even"}
            </span>
          </div>
          <div style={{ fontSize: 11, color: T3, marginTop: 6 }}>
            {topStreakDays > 0 ? `${topStreakDays}-day top streak` : "Journal · purity · nutrition"}
          </div>
        </StatCard>
        <StatCard onClick={() => onNavigate("firm:doctrine")}>
          <SectionLabel icon={<span style={{ fontSize: 12 }}>⚙️</span>}>The Machine · Stark</SectionLabel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 34, ...big, color: gate.met ? GR : T1 }}>{gate.have}<span style={{ fontSize: 15, color: T3 }}>/{gate.need}</span></span>
            <span style={{ fontSize: 12, color: T2 }}>clean months · the gate</span>
          </div>
          <div style={{ fontSize: 11, color: T3, marginTop: 6 }}>
            Fleet ${Math.round(fleetEquity).toLocaleString()} · vault KES {kesShort(freedom.capital)}
          </div>
        </StatCard>
      </div>

      {/* ── 🗓️ YEAR OF CONSISTENCY — the full stat block ── */}
      <Card style={{ padding: "16px 20px", background: "linear-gradient(110deg,#151310,#0C0B0A)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <span style={{ ...UP, fontSize: 10, letterSpacing: 2.5, color: AC2 }}>Year of Consistency</span>
          <span style={{ fontSize: 11, color: T3 }}>{cs.daysRemaining} days left this cycle</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))", gap: 12, marginBottom: 12 }}>
          {[
            ["Current streak", `${cs.currentStreak}d`, AC],
            ["Longest streak", `${cs.longestStreak}d`, AC2],
            ["Consistency rate", `${cs.consistencyRate}%`, GR],
            ["Total activities", totalAct.toLocaleString(), T1],
            ["This week", `${cs.weeklyCompletion}%`, T1],
            ["This month", `${cs.monthlyCompletion}%`, T1],
          ].map(([l, v, c]) => (
            <div key={l}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: MONO }}>{v}</div>
              <div style={{ ...UP, fontSize: 9, color: T3, letterSpacing: 0.5, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>{consistencySentence}</div>
      </Card>

      {/* ── 🏆 PROGRESSION ── */}
      <StatCard onClick={() => onNavigate("journey")}>
        <SectionLabel icon={<Trophy size={12} color={AC} />}>Progression</SectionLabel>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 30, ...big }}>Level {xp?.level ?? 1}</span>
          <span style={{ fontSize: 12, color: T2 }}>{xp?.title}</span>
        </div>
        <div style={{ fontSize: 12, color: T2, fontFamily: MONO, marginTop: 6 }}>{(xp?.total ?? 0).toLocaleString()} / {(xp?.nextLevelXp ?? 100).toLocaleString()} XP</div>
        <div style={{ height: 4, background: BD, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${xp?.pctToNext ?? 0}%`, background: AC, borderRadius: 2 }} />
        </div>
        {nextReward && <div style={{ fontSize: 10.5, color: T3, marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Next: <span style={{ color: T2 }}>{nextReward}</span></div>}
      </StatCard>

      {/* ── 🔥 STREAKS (hidden when none) ── */}
      {streaks.length > 0 && (
        <div>
          <SectionLabel icon={<Flame size={12} color={AC} />}>Current Streaks</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {streaks.map((s) => (
              <div key={s.label} onClick={() => onNavigate("habits")} title={s.label}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, cursor: "pointer" }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{s.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: AC, fontFamily: MONO }}>{s.days}<span style={{ fontSize: 10, color: T3, fontWeight: 500 }}>d</span></span>
                <span style={{ fontSize: 11.5, color: T2, whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 📅 SCHEDULE · 💰 FINANCE · 📊 TRADING (each hides when empty) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
        {upcoming.length > 0 && (
          <StatCard>
            <SectionLabel icon={<CalendarClock size={12} color={AC} />}>Up Next</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {upcoming.map((e) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11.5, color: AC, fontFamily: MONO, width: 64, flexShrink: 0 }}>{e.allDay ? "all-day" : e.time}</span>
                  <span style={{ fontSize: 13, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                </div>
              ))}
            </div>
          </StatCard>
        )}

        {(incomeToday > 0 || fin.personalNetWorth !== 0) && (
          <StatCard onClick={() => onNavigate("firm:wealth")}>
            <SectionLabel icon={<DollarSign size={12} color={AC} />}>Finance</SectionLabel>
            <div style={{ fontSize: 28, ...big, color: fin.personalNetWorth >= 0 ? T1 : RE }}>KES {kes0(fin.personalNetWorth)}</div>
            <div style={{ fontSize: 10.5, color: T3, marginTop: 3 }}>Net worth</div>
            {incomeToday > 0 && <div style={{ fontSize: 12, color: GR, marginTop: 8 }}>+KES {kes0(incomeToday)} income today</div>}
          </StatCard>
        )}

        {isTradingDay && (
          <StatCard onClick={() => onNavigate("firm:trading")} style={{ borderColor: kz.active ? `${AC}44` : BD }}>
            <SectionLabel icon={<TrendingUp size={12} color={AC} />}>Trading{kz.active ? " · Killzone" : ""}</SectionLabel>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 26, ...big, color: T1 }}>{tradeCountToday}</span>
              <span style={{ fontSize: 11, color: T3 }}>trade{tradeCountToday === 1 ? "" : "s"} logged today</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 9, fontSize: 11.5, color: T2 }}>
              <span style={{ color: kz.active ? GR : T3 }}>{kz.active ? "Session live" : "Outside killzone"}</span>
              {tradesToday.length > 0 && (
                <span style={{ color: checklistOk ? GR : AM, display: "flex", alignItems: "center", gap: 4 }}>
                  {checklistOk ? <><Check size={11} /> Checklist</> : "Checklist gaps"}
                </span>
              )}
            </div>
          </StatCard>
        )}
      </div>

      <OverheadToday actual={monthExpenses} />

      {/* ── ❤️ SYSTEM HEALTH ── */}
      <div>
        <SectionLabel icon={<HeartPulse size={12} color={AC} />}>System Health</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {health.map((h) => (
            <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", background: B2, border: `1px solid ${BD}`, borderRadius: 12 }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: HEALTH[h.state], boxShadow: `0 0 8px ${HEALTH[h.state]}66`, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{h.label}</div>
                <div style={{ fontSize: 11, color: T3 }}>{h.word}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      </>)}

      {/* ── 📅 WEEK IN REVIEW ── */}
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
