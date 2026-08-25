// ── useXp: one hook, the whole progression state ─────────────────────
// Subscribes to every store the XP engine derives from, so any qualifying
// action anywhere in the app updates XP instantly (and cross-tab / cross-
// device via the same sync events the stores already emit).
import { useEffect, useMemo } from "react";
import { useStorageState } from "./useStorageState.js";
import { computeXp } from "./xpEngine.js";
import { runXp } from "./xp/run.js";
import { writeStore } from "./useStorageState.js";
import { LEDGER_KEY } from "./xp/ledger.js";
import { gymSessionsToWorkouts } from "../modules/gym/gymSessions.js";
import { isScheduled } from "../modules/habits/logic/schedule";
import { localDateStr } from "./dates.js";

// Sum the last `n` banked days, inclusive of today.
function sumDays(byDay, n, today) {
  let s = 0;
  const d = new Date(`${today}T12:00:00`);
  for (let i = 0; i < n; i++) {
    const ds = localDateStr(d);
    s += byDay[ds] || 0;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

export function useXp() {
  const todayDs = localDateStr();
  const [habits, , l1] = useStorageState("habits", []);
  const [purity, , l2] = useStorageState("purity_log", {});
  const [trades] = useStorageState("ict_trades", []);
  const [reviews] = useStorageState("ict_reviews", []);
  const [workouts] = useStorageState("athlete_workouts", []);
  const [gymSessions] = useStorageState("gym_sessions", []);
  const [measurements] = useStorageState("athlete_measurements", []);
  const [nutrition] = useStorageState("nutrition_log", {});
  const [nutritionProfile] = useStorageState("nutrition_profile", null);
  const [finance] = useStorageState("finance_state", null);
  const [entries] = useStorageState("journal_entries", []);
  const [missions] = useStorageState("missions", []);
  const [church] = useStorageState("faith_church", []);
  const [verses] = useStorageState("faith_scripture", []);
  const [faithNotes] = useStorageState("faith_notes", []);
  const [library] = useStorageState("mind_library", []);
  const [mindNotes] = useStorageState("mind_notes", []);
  const [decisions] = useStorageState("mind_decisions", []);
  const [unlocked, setUnlocked, l3] = useStorageState("xp_achievements", {});
  const [logins, setLogins, l4] = useStorageState("xp_logins", {});
  const [notifLog] = useStorageState("notif_log", []);
  const [goals] = useStorageState("goals", []);
  const [wants] = useStorageState("wants", []);
  const [tiTrades] = useStorageState("ti_trades", []);
  const [photos] = useStorageState("athlete_photos", []);
  // New habit tracker's stores — a logged habit moves the shared level, the
  // Habit Mastery / Perfect Days / Streak journeys and the consistency
  // engine's life-day, all through the same derive-only pipeline.
  const [htHabits] = useStorageState("ht_habits", []);
  const [htEntries] = useStorageState("ht_entries", []);
  const [sleep] = useStorageState("trade_sleep", {});
  const [rawLedger, , l5] = useStorageState(LEDGER_KEY, null);

  // Gym-facet sessions feed the same fitness pipeline by mapping to the legacy
  // `workouts` shape, so a logged workout moves the shared level, the Iron Body
  // journey and the consistency engine's fitness-day — no XP-engine changes.
  // Same merge as useWorkouts(); kept inline here because this hook already
  // holds both stores for its other derivations.
  const allWorkouts = useMemo(
    () => [...(Array.isArray(workouts) ? workouts.filter(Boolean) : []), ...gymSessionsToWorkouts(gymSessions)],
    [workouts, gymSessions]
  );

  // Journal text keyed by day — the engine refuses to pay for an entry under
  // the minimum word count, and needs the text to count it.
  const journalText = useMemo(() => {
    const out = {};
    for (const e of Array.isArray(entries) ? entries : []) {
      const d = String(e?.date || "").slice(0, 10);
      if (!d) continue;
      out[d] = `${out[d] || ""} ${e.text || ""}`.trim();
    }
    return out;
  }, [entries]);

  const xp = useMemo(
    () => computeXp({
      habits, purity, trades, reviews, workouts: allWorkouts, measurements, finance,
      entries, missions, church, verses, faithNotes, library, mindNotes,
      decisions, unlocked, logins, nutrition, nutritionProfile, notifLog, goals, wants, tiTrades, photos,
      htHabits, htEntries,
    }),
    [habits, purity, trades, reviews, allWorkouts, measurements, finance,
     entries, missions, church, verses, faithNotes, library, mindNotes,
     decisions, unlocked, logins, nutrition, nutritionProfile, notifLog, goals, wants, tiTrades, photos,
     htHabits, htEntries]
  );

  // ── The banked ledger is the live XP source ──────────────────────
  // computeXp survives only as the counters and journeys engine; every number
  // the user sees as XP comes from here (criterion 10). `derivedTotal` is
  // read once, to open the ledger with the pre-revamp total intact.
  const ledger = useMemo(
    () => runXp({
      deps: {
        htHabits, htEntries, workouts: allWorkouts, nutrition, nutritionProfile,
        sleep, finance, reviews, church, verses, faithNotes, missions,
        mindNotes, decisions, library, goals, wants,
        journalTextByDate: journalText,
      },
      ledger: rawLedger,
      // The historical carry-forward is written once by the boot migration
      // (shared/xp/openMigration.js), which is the only thing that can still
      // compute it — the old engine no longer prices anything. Passing 0 here
      // would open an empty ledger and lose that history, so this render path
      // must never be the thing that opens one.
      derivedTotal: rawLedger?.opening?.xp ?? 0,
      isScheduledOn: (h, ds) => isScheduled(h, ds),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [htHabits, htEntries, allWorkouts, nutrition, nutritionProfile, sleep, finance,
     reviews, church, verses, faithNotes, missions, mindNotes, decisions, library,
     goals, wants, journalText, rawLedger],
  );

  // Persist whatever was banked. Writing through writeStore keeps the ledger
  // on the same sync path as every other store.
  useEffect(() => {
    if (!l5 || !ledger.changed) return;
    writeStore(LEDGER_KEY, ledger.ledger);
  }, [l5, ledger.changed, ledger.ledger]);

  // computeXp survives as the counters / journeys / achievements engine only.
  // Everything it returns is spread first so those keep working, then every
  // XP-bearing field is overridden by the ledger — so no number the user sees
  // as XP can come from the old value table (criterion 10). The old engine's
  // own totals are now dead weight; they come out in Gate 5, when analytics
  // and the journeys move onto the ledger too.
  // Weekly XP bars and the best day come from banked days now, not from the
  // old engine — it no longer knows what anything is worth.
  const weekly = useMemo(() => {
    const out = [];
    for (let w = 11; w >= 0; w--) {
      let sum = 0;
      for (let i = w * 7; i < w * 7 + 7; i++) {
        const d = new Date(`${todayDs}T12:00:00`); d.setDate(d.getDate() - i);
        sum += ledger.byDay[localDateStr(d)] || 0;
      }
      out.push({ label: w === 0 ? "Now" : `-${w}w`, xp: sum });
    }
    return out;
  }, [ledger.byDay, todayDs]);
  const bestDay = useMemo(() => {
    let best = null;
    for (const [d, v] of Object.entries(ledger.byDay)) if (!best || v > best[1]) best = [d, v];
    return best;
  }, [ledger.byDay]);

  return {
    ...xp,
    cats: ledger.byDomain,
    byCat: ledger.byDomain,
    weekly,
    bestDay,
    streakXp: 0,
    total: ledger.total,
    byDay: ledger.byDay,
    level: ledger.level,
    title: ledger.rank.l,
    rank: ledger.rank,
    nextRank: ledger.nextRank,
    nextLevelXp: ledger.nextLevelXp,
    toNext: ledger.toNext,
    xpIntoLevel: ledger.xpIntoLevel,
    xpForNext: ledger.xpForNext,
    pctToNext: ledger.xpForNext > 0 ? Math.round((ledger.xpIntoLevel / ledger.xpForNext) * 100) : 0,
    todayLedger: ledger.today,
    difficulty: ledger.difficulty,
    opening: ledger.opening,
    ledger: ledger.ledger,
    // Period aggregates, recomputed from the banked days rather than from the
    // old engine's derived events.
    today: ledger.byDay[todayDs] || 0,
    week: sumDays(ledger.byDay, 7, todayDs),
    month: sumDays(ledger.byDay, 31, todayDs),
    year: sumDays(ledger.byDay, 366, todayDs),
    avg30: Math.round(sumDays(ledger.byDay, 30, todayDs) / 30),
    loaded: l1 && l2 && l3 && l4 && l5,
    setUnlocked, setLogins,
  };
}
