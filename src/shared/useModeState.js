// ── useModeState — the single read-out of the rules engine ───────────
// Composes every existing gate's status into one God Mode score. Reads
// only in-memory local data (never a network fetch), recomputes live as
// gates change, and commits each closed day's final state to history once.
// It duplicates no gate logic — it calls the same engines the modules do.
import { useEffect, useMemo, useState } from "react";
import { useStorageState } from "./useStorageState.js";
import { localDateStr, daysAgoStr } from "./dates.js";
import {
  DEFAULT_MODE_CFG, sanitizeModeCfg, cutoffPassed,
  sleepStatus, cooldownStatus, capStatus, pingsStatus, checklistStatus,
  nutritionFloorStatus, nutritionCeilStatus, weeklyFocusStatus, overheadStatus,
  godScore, dayTier, gateImpacts, weekAverage, commitClosedDay, dayEngaged,
} from "./modes.js";
import { sanitizeTrades, netPnl } from "../modules/trading/intel/tradingIntel.js";
import { sanitizeGates, sanitizeSleep, evalGates } from "./tradeGates.js";
import { sanitizeHard, hardActiveOn, evalDay } from "../modules/athlete/nutritionHard.js";
import { sanitizeProfile } from "../modules/athlete/nutrition.js";
import { seasonFloorAdjust } from "./season.js";
import {
  sanitizeChecklist, sanitizeChecklistLog, isChecked, sanitizePings, pingDue,
  sanitizeWeekly, weekKey, sanitizeOverhead,
} from "./today.js";

// Build the gate-status list for one day. `dayClosed` flips nutrition-floor
// and checklist "incomplete" (still time) into "fail" (the day is over).
function buildStatuses(ds, dayClosed, S, cfg) {
  const out = [];

  // ── Trading gates (cap / cooldown / sleep) via the same evalGates ──
  const sleepHours = S.sleep[ds];
  const gate = evalGates({
    trades: S.trades, cfg: S.gates, sleepHours, checklistDone: true,
    netPnlOf: netPnl, now: Date.now(), ds,
  });
  out.push({ key: "cap", label: "Trade cap", status: capStatus(gate.count, gate.cap) });
  out.push({ key: "cooldown", label: "Post-loss cooldown", status: cooldownStatus(gate.cooldownMs) });
  out.push({ key: "sleep", label: "Sleep gate", status: sleepStatus(gate.sleep, sleepHours != null && sleepHours !== "") });

  // ── Nutrition floors + ceiling (only when God-Mode nutrition is on) ──
  const hardActive = hardActiveOn(S.hard, ds);
  const entries = Array.isArray(S.log?.[ds]) ? S.log[ds] : [];
  const adj = seasonFloorAdjust(S.season, ds); // Season lowers floors, so a fast never tanks the score
  const nutri = hardActive ? evalDay(entries, S.hard, S.profile, ds, adj) : null;
  out.push({ key: "nutriFloor", label: "Nutrition floor", status: nutritionFloorStatus(hardActive, !!nutri && nutri.proteinMet && nutri.overFloor, dayClosed) });
  out.push({ key: "nutriCeil", label: "Nutrition ceiling", status: nutritionCeilStatus(hardActive, !nutri || nutri.underCeil) });

  // ── Daily checklist (core items, grace until the cutoff hour) ──────
  const coreItems = S.checklist.filter((i) => i.core);
  const coreDone = coreItems.filter((i) => isChecked(S.clog, ds, i.id)).length;
  const passedCutoff = dayClosed || cutoffPassed(cfg.checklistCutoffHour);
  out.push({ key: "checklist", label: "Daily checklist", status: checklistStatus(coreItems.length, coreDone, passedCutoff) });

  // ── Recurring life pings (an overdue ping is a violation) ─────────
  // ── Recurring life pings (an *overdue* ping is a violation) ───────
  // A ping that has never been actioned (lastDone null — the shipped
  // defaults) has no lapsed cadence to violate; only a ping that was kept
  // and has now slipped past its interval counts. Otherwise God would be
  // permanently unreachable for anyone who never touched the pings feature.
  const anyDue = S.pings.some((p) => p.lastDone && pingDue(p, ds));
  out.push({ key: "pings", label: "Recurring pings", status: pingsStatus(anyDue) });

  // ── Weekly focus — structural. Unset for the week scores 0 (decay),
  //    never "off": leaving the focus blank is itself a missed step. ──
  const focusSet = S.weekly.text.trim() !== "" && S.weekly.week === weekKey(ds);
  out.push({ key: "weeklyFocus", label: "Weekly focus", status: weeklyFocusStatus(focusSet, focusSet) });

  // ── Monthly overhead pace — structural. Unset scores 0; when set, on
  //    track means actual spend has not outrun the month's pro-rated pace. ──
  const ohSet = S.overhead.targetKsh > 0;
  const dayOfMonth = +ds.slice(8, 10);
  const daysInMonth = new Date(+ds.slice(0, 4), +ds.slice(5, 7), 0).getDate();
  const paceAllowance = S.overhead.targetKsh * (dayOfMonth / daysInMonth);
  out.push({ key: "monthlyOverhead", label: "Monthly overhead", status: overheadStatus(ohSet, ohSet && S.financeActual <= paceAllowance) });

  return out;
}

export function useModeState() {
  const [rawCfg] = useStorageState("mode_cfg", DEFAULT_MODE_CFG);
  const [rawTrades] = useStorageState("ict_trades", []);
  const [rawGates] = useStorageState("trade_gates", null);
  const [rawSleep] = useStorageState("trade_sleep", {});
  const [rawHard] = useStorageState("nutrition_hard", null);
  const [rawLog] = useStorageState("nutrition_log", {});
  const [rawProfile] = useStorageState("nutrition_profile", null);
  const [rawSeason] = useStorageState("active_season", null);
  const [rawChecklist] = useStorageState("daily_checklist", []);
  const [rawClog] = useStorageState("daily_checklist_log", {});
  const [rawPings] = useStorageState("life_pings", null);
  const [rawWeekly] = useStorageState("weekly_goal", {});
  const [rawOverhead] = useStorageState("monthly_overhead", {});
  const [rawFinance] = useStorageState("finance_state", null);
  const [history, setHistory] = useStorageState("mode_history", {});

  // Re-tick through the day so cooldowns, the checklist cutoff, and midnight
  // rollover all reflect live without a manual refresh.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const cfg = useMemo(() => sanitizeModeCfg(rawCfg), [rawCfg]);
  const S = useMemo(() => ({
    trades: sanitizeTrades(rawTrades),
    gates: rawGates, // evalGates sanitizes internally
    sleep: sanitizeSleep(rawSleep),
    hard: sanitizeHard(rawHard),
    log: rawLog && typeof rawLog === "object" ? rawLog : {},
    profile: sanitizeProfile(rawProfile),
    season: rawSeason,
    checklist: sanitizeChecklist(rawChecklist),
    clog: sanitizeChecklistLog(rawClog),
    pings: sanitizePings(rawPings),
    weekly: sanitizeWeekly(rawWeekly),
    overhead: sanitizeOverhead(rawOverhead),
    // Overhead "actual" proxy: this month's tracked bills (matches the
    // Command Center's overhead figure — same single source).
    financeActual: (() => { const b = rawFinance && Array.isArray(rawFinance.bills) ? rawFinance.bills : []; return b.reduce((s, x) => s + (+x?.amount || 0), 0); })(),
  }), [rawTrades, rawGates, rawSleep, rawHard, rawLog, rawProfile, rawSeason, rawChecklist, rawClog, rawPings, rawWeekly, rawOverhead, rawFinance]);

  const ds = localDateStr();
  const statuses = useMemo(() => buildStatuses(ds, false, S, cfg), [ds, S, cfg, tick]);
  const score = useMemo(() => godScore(statuses, cfg), [statuses, cfg]);
  const impacts = useMemo(() => gateImpacts(statuses, cfg), [statuses, cfg]);
  const tier = dayTier(score, cfg);
  // 7-day rolling average — today's live score substituted for today, past
  // days from history. This is what Journals shows so one clean day never
  // overwrites a shaky week.
  const weekAvg = useMemo(() => weekAverage(history, score, ds, 7), [history, score, ds]);

  // Commit the previous day's final score exactly once (handles a normal open
  // the next morning and a rollover while the app stays open). Uses local data
  // only, so it never records a score that depends on a pending sync.
  useEffect(() => {
    const y = daysAgoStr(1);
    if (history && history[y]) return;
    const yStatuses = buildStatuses(y, true, S, cfg);
    if (!dayEngaged(yStatuses)) return; // don't record a day the owner never touched
    setHistory((h) => commitClosedDay(h, y, godScore(yStatuses, cfg)));
  }, [ds, S, cfg]); // eslint-disable-line

  return { score, tier, weekAvg, impacts, statuses, cfg, history };
}
