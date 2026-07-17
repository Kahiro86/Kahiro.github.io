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
import { BD, T1, T2, T3, GL, B2, AC, GR, AM, RE } from "../../shared/designTokens.js";
import { Card, Hydrating } from "../../shared/ui.jsx";
import { Ring } from "../../shared/charts.jsx";
import { useCountUp } from "../../shared/useCountUp.js";

const GOLD = "#F0B429"; // reserved for the perfect-day hero only
import { useStorageState } from "../../shared/useStorageState.js";
import { getActiveKillzone, getEATTimeStr } from "../trading/timezone.js";
import { getStats, tradingMetrics } from "../trading/helpers.js";
import { financeSummary } from "../finance/summary.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";
import { WEEK_PLAN } from "../athlete/constants.js";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import {
  isScheduled, isDone, isNonNeg, isWellness, isWeekly, valueOn, currentStreak,
} from "../../shared/habitEngine.js";
import { buildNudges } from "../../shared/insights.js";
import {
  sanitizeNutrition, dayEntries, dayTotals, calcTargets, healthyStreaks,
} from "../athlete/nutrition.js";
import { sanitizePurity } from "../life/purity.js";
import { getGcalConfig, todaysEvents } from "../../shared/gcal.js";

const kes0 = (n) => Math.round(+n || 0).toLocaleString();
const weekdayName = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
const isRestDay = (ds) => WEEK_PLAN.find((d) => d.day === weekdayName(ds))?.type === "Rest";

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

export function Dashboard({ onNavigate, habits: habitsV2, setHabits, loaded = true, xp }) {
  const [kz, setKz] = useState(getActiveKillzone);
  const [, setEatTime] = useState(getEATTimeStr);
  const [trades] = useStorageState("ict_trades", []);
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

  useEffect(() => {
    const t = setInterval(() => { setKz(getActiveKillzone()); setEatTime(getEATTimeStr()); }, 30000);
    return () => clearInterval(t);
  }, []);

  const ds = localDateStr();
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

  // ── ⚠️ PRIORITY ALERTS: the urgent nudges only, max 3 ──
  const alerts = useMemo(() => {
    const all = buildNudges({ habits: habitsV2, trades, reviews: rawReviews, bills: finance.bills, verses, decisions, purity, nutrition: nutritionLog, nutritionProfile });
    return all.filter((n) => n.tone === "urgent").slice(0, 3);
  }, [habitsV2, trades, rawReviews, finance.bills, verses, decisions, purity, nutritionLog, nutritionProfile]);

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
  const isTradingDay = kz.active || tradesToday.length > 0;
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

  // Animated figures — roll up on load, tick on change.
  const perfect = mission.pct === 100 && mission.total > 0;
  const cuPct = useCountUp(mission.pct);
  const cuScore = useCountUp(lifeScore);
  const cuXp = useCountUp(xp?.total ?? 0);
  const cuNet = useCountUp(fin.personalNetWorth);
  const cuPnl = useCountUp(Math.round(tMetrics.dailyPnl));

  if (!loaded) return <Hydrating label="Waking the Command Center…" />;

  const big = { fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, color: T1, lineHeight: 1 };

  return (
    <div className="cockpit" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1080, margin: "0 auto" }}>

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

      {/* ── 📈 DAILY SCORE + 🏆 XP ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        <StatCard onClick={() => onNavigate("analytics")}>
          <SectionLabel icon={<TrendingUp size={12} color={AC} />}>Life Score</SectionLabel>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 46, ...big, color: lifeScore >= 80 ? GR : lifeScore >= 50 ? AM : RE }}>{cuScore}%</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: scoreDelta > 0 ? GR : scoreDelta < 0 ? RE : T3 }}>
              {scoreDelta > 0 ? `↑ +${scoreDelta}%` : scoreDelta < 0 ? `↓ ${scoreDelta}%` : "· even"}
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: T3, marginTop: 4 }}>vs yesterday</div>
        </StatCard>

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
          <StatCard onClick={() => onNavigate("finance")}>
            <SectionLabel icon={<DollarSign size={12} color={AC} />}>Finance</SectionLabel>
            <div style={{ fontSize: 28, ...big, color: fin.personalNetWorth >= 0 ? T1 : RE }}>KES {kes0(cuNet)}</div>
            <div style={{ fontSize: 10.5, color: T3, marginTop: 3 }}>Net worth</div>
            {incomeToday > 0 && <div style={{ fontSize: 12, color: GR, marginTop: 8 }}>+KES {kes0(incomeToday)} income today</div>}
          </StatCard>
        )}

        {isTradingDay && (
          <StatCard onClick={() => onNavigate("trading")} style={{ borderColor: kz.active ? `${AC}44` : BD }}>
            <SectionLabel icon={<TrendingUp size={12} color={AC} />}>Trading{kz.active ? " · Live" : ""}</SectionLabel>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 26, ...big, color: tMetrics.dailyPnl > 0 ? GR : tMetrics.dailyPnl < 0 ? RE : T1 }}>
                {tMetrics.dailyPnl >= 0 ? "+" : "−"}${Math.abs(cuPnl).toLocaleString()}
              </span>
              <span style={{ fontSize: 11, color: T3 }}>today</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 9, fontSize: 11.5, color: T2 }}>
              <span>{tradesToday.length} trade{tradesToday.length === 1 ? "" : "s"}</span>
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
    </div>
  );
}
