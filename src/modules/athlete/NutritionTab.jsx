// ── Nutrition tab (Athlete OS) ───────────────────────────────────────
// Log fast, learn slow: a sub-10-second meal logger on top of the
// nutrition engine's full analysis. Water reads the Life OS Hydration
// wellness habit — one hydration tracker across the whole app.
import { useMemo, useState, useEffect } from "react";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Star, Search, Copy, ChevronUp, Flame, Dumbbell, Link2, Check, CircleDashed } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, CY, PU, GR, RE, AM, AC2 } from "../../shared/designTokens.js";
import { Card, SH, Chip, Meter, Empty } from "../../shared/ui.jsx";
import { DatePicker } from "../../shared/DatePicker.jsx";
import { useDayMarks, hasCheat, toggleMark } from "../../shared/dayMarks.js";
import { MotivePush } from "../../shared/MotivePush.jsx";
import { Collapse } from "../../shared/Collapse.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { Ring } from "../../shared/charts.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import { migrateHabits, isWellness, valueOn } from "../../shared/habitEngine.js";
import { callClaude, getApiKey } from "../../shared/anthropic.js";
import {
  FOOD_DB, SLOTS, SHIFT_SLOTS, GOALS, ACTIVITY, NUTRIENTS, MICROS, DEFAULT_PROFILE,
  sanitizeNutrition, sanitizeFoods, sanitizeProfile, calcTargets,
  newEntry, scaleNutrients, dayTotals, dayEntries, coverage,
  nutritionScore, qualitySuggestions, nutritionSeries, healthyStreaks, nutritionReport,
  frequentEntries, slotForNow, applyVariant, duplicateFood,
  AI_MEAL_SYSTEM, parseAiEstimate,
} from "./nutrition.js";
import {
  DEFAULT_HARD, sanitizeHard, hardActiveOn, evalDay, isDayClosed,
  isSugaredBev, LOW_APPETITE_OPTIONS,
} from "./nutritionHard.js";
import { sanitizeSeason, seasonActive, seasonDay, seasonTemplate, seasonFloorAdjust } from "../../shared/season.js";
import { gymLink } from "./gymSync.js";
import { Lock } from "lucide-react";

const input = { background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const nowTime = () => new Date().toTimeString().slice(0, 5);

// Number field with a local text buffer: lets you clear it and type freely
// (intermediate/empty values allowed) and only commits the parsed number on
// blur. Without this, a controlled input reading a value the engine clamps
// every keystroke snaps back to the default mid-edit and feels uneditable.
function NumField({ label, value, onCommit, width = 84 }) {
  const [txt, setTxt] = useState(String(value ?? ""));
  useEffect(() => { setTxt(String(value ?? "")); }, [value]);
  return (
    <label style={{ fontSize: 10, color: T3, display: "flex", flexDirection: "column", gap: 3 }}>{label}
      <input type="number" inputMode="numeric" value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => onCommit(txt.trim() === "" ? 0 : +txt)}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        style={{ ...input, width, fontFamily: "monospace", marginTop: 3 }} />
    </label>
  );
}

export function NutritionTab() {
  const [rawLog, setLog] = useStorageState("nutrition_log", {});
  const [rawFoods, setFoods] = useStorageState("nutrition_foods", []);
  const [rawProfile, setProfile] = useStorageState("nutrition_profile", DEFAULT_PROFILE);
  const [rawHabits] = useStorageState("habits", []);
  const [rawHard] = useStorageState("nutrition_hard", DEFAULT_HARD);
  const [days, setDays] = useStorageState("nutrition_days", {}); // { ds: { completedAt, clean } }
  const [gymSessions] = useStorageState("gym_sessions", []);
  const [measurements] = useStorageState("athlete_measurements", []);
  const toast = useToast();
  const today = localDateStr();
  // The log is backdatable — `logDs` is the day being viewed/logged (defaults
  // to today, moved via the DatePicker). Healthy-streak tracking still
  // anchors on the real `today`, since a streak is inherently about what's
  // true right now, not whichever day the user happens to be viewing.
  const [logDs, setLogDs] = useState(() => localDateStr());
  const [dayMarks, setDayMarks] = useDayMarks();
  const cheatToday = hasCheat(dayMarks, logDs);

  const log = useMemo(() => sanitizeNutrition(rawLog), [rawLog]);
  const customFoods = useMemo(() => sanitizeFoods(rawFoods), [rawFoods]);
  const profile = useMemo(() => sanitizeProfile(rawProfile), [rawProfile]);
  const targets = useMemo(() => calcTargets(profile), [profile]);
  const gym = useMemo(() => gymLink(gymSessions, logDs), [gymSessions, logDs]);

  const entries = dayEntries(log, logDs);
  const totals = useMemo(() => dayTotals(entries), [entries]);
  const score = nutritionScore(totals, targets);
  const suggestions = useMemo(() => qualitySuggestions(totals, targets, entries), [totals, targets, entries]);
  // Season-tagged days are excluded from healthy-streak grading (like a
  // cheat day) so a fast never counts against normal-mode targets.
  const seasonDays = useMemo(() => Object.entries(log).filter(([, es]) => Array.isArray(es) && es.some((e) => e && e.season)).map(([d]) => d), [log]);
  const streaks = useMemo(() => healthyStreaks(log, targets, today, [...(dayMarks.cheat || []), ...seasonDays]), [log, targets, today, dayMarks.cheat, seasonDays]);
  const series = useMemo(() => nutritionSeries(log, targets, 14), [log, targets]);
  const report7 = useMemo(() => nutritionReport(log, targets, 7), [log, targets]);
  const report30 = useMemo(() => nutritionReport(log, targets, 30), [log, targets]);

  // Hydration from the shared wellness habit — never a second water store.
  const water = useMemo(() => {
    const h = migrateHabits(rawHabits).find((x) => x && !x.archived && isWellness(x) && /hydra|water/i.test(x.name || ""));
    if (!h) return null;
    return { done: valueOn(h, logDs), target: h.target || 2, unit: h.unit || "L" };
  }, [rawHabits, logDs]);

  // Recents: unique foods from the last 14 days, most recent first.
  const recents = useMemo(() => {
    const seen = new Map();
    for (let i = 0; i < 14; i++) {
      for (const e of dayEntries(log, daysAgoStr(i))) {
        if (!seen.has(e.name)) seen.set(e.name, { name: e.name, grams: e.grams, proc: e.proc, per100: null, n: e.n });
      }
    }
    return [...seen.values()].slice(0, 8);
  }, [log]);

  const allFoods = useMemo(() => [...customFoods, ...FOOD_DB], [customFoods]);
  // Quick calorie bumps (QUICK-ADD tag) — one tap logs the item at its serving.
  const quickAddFoods = useMemo(() => [...customFoods, ...FOOD_DB].filter((f) => Array.isArray(f.tags) && f.tags.includes("QUICK-ADD")), [customFoods]);
  // Supplement adherence (creatine / magnesium) — a daily checkmark, not a macro entry.
  const [supps, setSupps] = useStorageState("nutrition_supps", {});
  const suppsToday = (supps && typeof supps === "object" && supps[logDs] && typeof supps[logDs] === "object") ? supps[logDs] : {};
  const toggleSupp = (id) => setSupps((p) => { const s = (p && typeof p === "object" && !Array.isArray(p)) ? { ...p } : {}; const d = { ...(s[logDs] || {}) }; d[id] = !d[id]; s[logDs] = d; return s; });

  // ── Season (Daniel Fast etc.) — reframes + adjusts floors while active ──
  const [rawSeason] = useStorageState("active_season", null);
  const season = useMemo(() => sanitizeSeason(rawSeason), [rawSeason]);
  const seasonOn = seasonActive(rawSeason, logDs);
  const seasonTpl = seasonTemplate(rawSeason);
  const floorAdjust = useMemo(() => seasonFloorAdjust(rawSeason, logDs), [rawSeason, logDs]);

  // ── God Mode (opt-in strict enforcement) ──────────────────────────
  const hard = useMemo(() => sanitizeHard(rawHard), [rawHard]);
  const hardOn = hardActiveOn(hard, logDs);
  const hardEval = useMemo(() => (hardOn ? evalDay(entries, hard, profile, logDs, floorAdjust) : null), [hardOn, entries, hard, profile, logDs, floorAdjust]);
  // A day is locked from edits once it's marked complete, or once God Mode
  // has carried it into the past (no retroactive editing of a closed day).
  const dayLocked = hardOn && (isDayClosed(hard, logDs, today) || !!days[logDs]?.completedAt);

  // ── Mutations (always via sanitize → the log can never go bad) ──────
  const writeDay = (ds, fn) => {
    if (dayLocked) { toast("This day is closed — God Mode locks completed and past days.", { tone: "info" }); return; }
    setLog((prev) => {
    const clean = sanitizeNutrition(prev);
    const next = fn(clean[ds] || []);
    const out = { ...clean };
    if (next.length) out[ds] = next; else delete out[ds];
    return out;
    });
  };
  const markDayComplete = () => {
    if (!hardEval) return;
    setDays((d) => ({ ...(d && typeof d === "object" ? d : {}), [logDs]: { completedAt: Date.now(), clean: hardEval.clean } }));
    toast(hardEval.clean ? "Day completed — clean." : "Day completed.", { tone: "success" });
  };
  const addEntry = (entry) => {
    // Tag entries logged during a season so they never get compared against
    // normal-mode targets in historical views.
    const e = seasonOn && season ? { ...entry, season: season.name } : entry;
    writeDay(logDs, (list) => [...list, e]);
    toast(`${e.name} logged · ${Math.round(e.n.kcal || 0)} kcal`, { tone: "success", duration: 2200 });
  };
  const removeEntry = (id) => {
    const e = entries.find((x) => x.id === id);
    writeDay(logDs, (list) => list.filter((x) => x.id !== id));
    if (e) toast(`${e.name} removed`, { action: "Undo", onAction: () => writeDay(logDs, (l) => [...l, e]), tone: "danger" });
  };
  // Edit grams → nutrients recompute from the source food when known,
  // otherwise scale the stored values proportionally.
  const setGrams = (id, grams) => writeDay(logDs, (list) => list.map((e) => {
    if (e.id !== id) return e;
    const g = Math.max(0, +grams || 0);
    const src = allFoods.find((f) => f.name === e.name);
    const n = src ? scaleNutrients(src.per100, g) : (e.grams > 0 ? Object.fromEntries(Object.entries(e.n).map(([k, v]) => [k, Math.round((v / e.grams) * g * 10) / 10])) : e.n);
    return { ...e, grams: g, n };
  }));
  // God Mode caps sugared beverages: past the cap, the ONE-TAP shortcut is
  // withdrawn (manual entry via search still works — the cap adds friction,
  // it doesn't forbid). Detected from the source food's tags.
  const sugaredCapBlocks = (name) => {
    if (!hardOn || !hardEval || !hardEval.capReached) return false;
    const src = allFoods.find((f) => f.name === name);
    return !!(src && src.bev && Array.isArray(src.tags) && src.tags.includes("SUGAR"));
  };
  const capToast = () => toast(`Sugared-drink cap reached (${hard.sugaredCap}/day) — one-tap is off. Add it manually if you truly need it.`, { tone: "info" });

  // One-tap favourites: repeat meals log themselves into the slot the
  // current hour suggests — zero questions asked.
  const frequents = useMemo(() => frequentEntries(log), [log]);
  const logFrequent = (r) => {
    if (sugaredCapBlocks(r.name)) return capToast();
    addEntry({ id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, slot: slotForNow(), time: nowTime(),
      name: r.name, grams: r.grams, proc: r.proc, n: r.n });
  };
  const copyYesterday = () => {
    const prev = dayEntries(log, daysAgoStr(1));
    if (!prev.length) { toast("Nothing logged yesterday", { tone: "info" }); return; }
    writeDay(logDs, (list) => [...list, ...prev.map((e) => ({ ...e, id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}` }))]);
    toast(`Copied ${prev.length} item${prev.length > 1 ? "s" : ""} from yesterday`, { tone: "success" });
  };
  const toggleFav = (foodId) => setProfile((prev) => {
    const p = sanitizeProfile(prev);
    return { ...p, favs: p.favs.includes(foodId) ? p.favs.filter((x) => x !== foodId) : [...p.favs, foodId] };
  });

  // ── Add panel state ─────────────────────────────────────────────────
  const [adding, setAdding] = useState(null);      // slot id
  const [mode, setMode] = useState("search");       // search | custom | quick
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);             // food being portioned
  const [variant, setVariant] = useState(null);     // chosen variant id (plain/Greek/…)
  const [grams, setGramsInput] = useState("100");
  // The food actually logged — resolves the chosen variant's macros.
  const selFood = sel ? (variant ? applyVariant(sel, variant) : sel) : null;
  const [custom, setCustom] = useState(null);       // custom-food / recipe draft
  const [quick, setQuick] = useState({ name: "", kcal: "", p: "", c: "", f: "" });
  const [aiText, setAiText] = useState("");
  const [aiState, setAiState] = useState({ busy: false, est: null, err: null });

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const favs = profile.favs;
    const list = needle
      ? allFoods.filter((f) => f.name.toLowerCase().includes(needle))
      : [...allFoods.filter((f) => favs.includes(f.id)), ...allFoods.filter((f) => !favs.includes(f.id))];
    return list.slice(0, 12);
  }, [q, allFoods, profile.favs]);

  const closeAdd = () => { setAdding(null); setSel(null); setVariant(null); setQ(""); setMode("search"); setCustom(null); setAiState({ busy: false, est: null, err: null }); };

  // Duplicate any library item into an editable custom food, then open the
  // editor on it — the copy's macros are yours to change (defaults, not truths).
  const duplicateItem = (f) => {
    const d = duplicateFood(f);
    setFoods((prev) => [d, ...sanitizeFoods(prev)]);
    setMode("custom"); setSel(null); setVariant(null);
    setCustom({ recipe: false, editId: d.id, name: d.name, per100: { ...d.per100 }, items: [], iq: "" });
    toast(`Duplicated "${d.name}" — edit its macros, then Save`, { tone: "success" });
  };

  // AI estimation: describe → preview → confirm. Nothing logs without a look.
  const runAiEstimate = async () => {
    if (!aiText.trim() || aiState.busy) return;
    setAiState({ busy: true, est: null, err: null });
    try {
      const reply = await callClaude({
        system: AI_MEAL_SYSTEM,
        messages: [{ role: "user", content: aiText.trim() }],
        maxTokens: 600,
      });
      const est = parseAiEstimate(reply);
      if (!est) throw new Error("Couldn't read the estimate — try describing the meal more concretely.");
      setAiState({ busy: false, est, err: null });
    } catch (err) {
      setAiState({ busy: false, est: null, err: err.message });
    }
  };
  const logAiEstimate = () => {
    const { est } = aiState;
    if (!est) return;
    addEntry({ id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, slot: adding, time: nowTime(),
      name: est.name, grams: est.grams, proc: est.proc, ai: true, n: est.n });
    setAiText("");
    setAiState({ busy: false, est: null, err: null });
  };
  const confirmAdd = () => {
    if (!selFood || !(+grams > 0)) return;
    addEntry(newEntry(selFood, +grams, adding, nowTime()));
    setSel(null); setVariant(null); setQ("");
  };
  const addRecent = (r) => {
    const src = allFoods.find((f) => f.name === r.name);
    addEntry(src ? newEntry(src, r.grams, adding, nowTime())
      : { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, slot: adding, time: nowTime(), name: r.name, grams: r.grams, proc: r.proc, n: r.n });
  };
  const saveQuick = () => {
    const kcal = +quick.kcal || 0;
    if (!kcal) return;
    addEntry({ id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, slot: adding, time: nowTime(),
      name: quick.name.trim() || "Quick add", grams: 0, proc: 2,
      n: { kcal, p: +quick.p || 0, c: +quick.c || 0, f: +quick.f || 0 } });
    setQuick({ name: "", kcal: "", p: "", c: "", f: "" });
  };
  // Custom food OR recipe: a recipe is just a custom food whose per-100g is
  // computed from its ingredients, so it logs and edits like any food.
  const startCustom = (recipe) => { setMode("custom"); setCustom({ recipe, name: "", per100: {}, items: [], iq: "" }); };
  const saveCustom = () => {
    if (!custom.name.trim()) return;
    let per100 = {}, proc = 2;
    if (custom.recipe) {
      const totalG = custom.items.reduce((s, it) => s + it.grams, 0);
      if (!totalG) return;
      const sum = {};
      for (const it of custom.items) {
        const n = scaleNutrients(it.food.per100, it.grams);
        for (const [k, v] of Object.entries(n)) sum[k] = (sum[k] || 0) + v;
      }
      for (const [k, v] of Object.entries(sum)) per100[k] = Math.round((v / totalG) * 100 * 10) / 10;
      proc = Math.round(custom.items.reduce((s, it) => s + (it.food.proc || 2), 0) / custom.items.length);
    } else {
      for (const k of ["kcal", "p", "c", "f", "fib", "sug", "na"]) if (+custom.per100[k]) per100[k] = +custom.per100[k];
      if (!per100.kcal) return;
    }
    // Editing a duplicated item updates it in place, keeping its
    // serving/tags/bev/variants; a fresh food gets a new id.
    if (custom.editId) {
      let updated = null;
      setFoods((prev) => sanitizeFoods(prev).map((f) => {
        if (f.id !== custom.editId) return f;
        updated = { ...f, name: custom.name.trim(), per100 };
        return updated;
      }));
      setSel(updated); setVariant(null); setMode("search"); setCustom(null);
      toast("Food updated — set the portion to log it", { tone: "success" });
      return;
    }
    const food = { id: `cf${Date.now().toString(36)}`, name: custom.name.trim(), per100, proc };
    setFoods((prev) => [food, ...sanitizeFoods(prev)]);
    setSel(food); setVariant(null); setMode("search"); setCustom(null);
    toast(`${custom.recipe ? "Recipe" : "Food"} saved — set the portion to log it`, { tone: "success" });
  };

  const pctKcal = targets.kcal ? Math.round((totals.kcal / targets.kcal) * 100) : 0;
  const remaining = Math.max(0, Math.round(targets.kcal - totals.kcal));
  const remainingP = Math.max(0, Math.round(targets.p - totals.p));
  const times = entries.map((e) => e.time).filter(Boolean).sort();
  const macroKcal = totals.p * 4 + totals.c * 4 + totals.f * 9 || 1;

  const selectFood = (f) => { setSel(f); setVariant(Array.isArray(f.variants) && f.variants.length ? f.variants[0].id : null); setGramsInput(String(f.serving ? f.serving.g : f.id.startsWith("db_olive") ? 15 : 100)); };
  const foodRow = (f) => (
    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: sel?.id === f.id ? `${GR}12` : GL, border: `1px solid ${sel?.id === f.id ? GR + "44" : BD}`, borderRadius: 9 }}>
      <button onClick={() => selectFood(f)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: T1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
          {f.bev && <span title="Beverage — counts toward fluids" style={{ fontSize: 9 }}>💧</span>}
          {Array.isArray(f.tags) && f.tags.slice(0, 2).map((t) => (
            <span key={t} style={{ fontSize: 8, letterSpacing: 0.5, color: T3, border: `1px solid ${BD}`, borderRadius: 5, padding: "1px 4px", whiteSpace: "nowrap" }}>{t}</span>
          ))}
        </span>
        <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace", whiteSpace: "nowrap" }}>{Math.round(f.per100.kcal || 0)} kcal · {Math.round(f.per100.p || 0)}g P /100g</span>
      </button>
      <button onClick={() => duplicateItem(f)} aria-label={`Duplicate ${f.name}`} title="Duplicate & edit into your own food" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 }}>
        <Copy size={12} color={T3} />
      </button>
      <button onClick={() => toggleFav(f.id)} aria-label={`Favorite ${f.name}`} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 }}>
        <Star size={12} color={profile.favs.includes(f.id) ? AM : T3} fill={profile.favs.includes(f.id) ? AM : "none"} />
      </button>
    </div>
  );

  // ── Mock-shaped Today derivations ──────────────────────────────────
  const goalLabel = GOALS.find((g) => g.id === profile.goal)?.l || "maintain";
  const dateLabel = new Date(`${logDs}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  // The four shift slots always show; any legacy slot with items is appended.
  const shownSlots = [
    ...SHIFT_SLOTS,
    ...SLOTS.slice(SHIFT_SLOTS.length).filter((s) => entries.some((e) => e.slot === s.id)),
  ];
  const slotTot = (id) => { const t = dayTotals(entries.filter((e) => e.slot === id)); return { kcal: Math.round(t.kcal || 0), p: Math.round(t.p || 0), n: entries.filter((e) => e.slot === id).length }; };
  const emptyShiftSlots = SHIFT_SLOTS.filter((s) => !entries.some((e) => e.slot === s.id)).length;
  // Logging gap over the trailing 30 days.
  let loggedDays30 = 0, kcalSum30 = 0;
  for (let i = 0; i < 30; i++) { const it = dayEntries(log, daysAgoStr(i)); if (it.length) { loggedDays30++; kcalSum30 += dayTotals(it).kcal || 0; } }
  const avgKcal30 = loggedDays30 ? Math.round(kcalSum30 / loggedDays30) : 0;
  // Composition — latest weight/waist from measurements, with a 2-week delta.
  const measArr = (Array.isArray(measurements) ? measurements : []).filter((m) => m && m.date).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const latestMeas = measArr[measArr.length - 1] || null;
  const twoWeekAgo = daysAgoStr(14);
  const priorMeas = [...measArr].reverse().find((m) => (m.date || "") <= twoWeekAgo) || measArr[0] || null;
  const curWeight = latestMeas && Number.isFinite(+latestMeas.weightKg) ? +latestMeas.weightKg : (Number.isFinite(+profile.weightKg) ? +profile.weightKg : null);
  const wDelta = latestMeas && priorMeas && latestMeas !== priorMeas && Number.isFinite(+latestMeas.weightKg) && Number.isFinite(+priorMeas.weightKg) ? +(latestMeas.weightKg - priorMeas.weightKg).toFixed(1) : null;
  const curWaist = latestMeas && Number.isFinite(+latestMeas.waistCm) ? +latestMeas.waistCm : null;
  const waistDelta = latestMeas && priorMeas && Number.isFinite(+latestMeas.waistCm) && Number.isFinite(+priorMeas.waistCm) ? +(latestMeas.waistCm - priorMeas.waistCm).toFixed(1) : null;
  const targetWeight = Number.isFinite(+profile.targetWeightKg) ? +profile.targetWeightKg : null;

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 900 }}>
      {/* ── subtitle: date · goal · targets (mock header line) ── */}
      <div style={{ fontSize: 11.5, color: T2 }}>
        {dateLabel} · <span style={{ color: AC2 }}>{goalLabel.toLowerCase()}</span> · {targets.kcal.toLocaleString()} kcal · {targets.p}g P
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}><DatePicker value={logDs} onChange={setLogDs} /></div>
        <button onClick={() => toggleMark(setDayMarks, "cheat", logDs)}
          title={cheatToday ? "This day is a cheat day — your streak is protected" : "Mark this day as a planned cheat day (streak-safe)"}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
            background: cheatToday ? `${AM}1c` : GL, border: `1px solid ${cheatToday ? AM + "66" : BD}`, color: cheatToday ? AM : T2 }}>
          🍔 {cheatToday ? "Cheat day ✓" : "Cheat day"}
        </button>
      </div>
      {cheatToday && (
        <div style={{ padding: "10px 15px", background: `${AM}0e`, border: `1px solid ${AM}33`, borderRadius: 11, fontSize: 12, color: T2, lineHeight: 1.5 }}>
          🍔 Cheat day — eat freely. This day won't count against your healthy streak, and the streak carries straight across it.
        </div>
      )}
      {seasonOn && season && seasonTpl && (
        <Card style={{ padding: "14px 16px", border: `1px solid ${AC2}55`, background: `${AC2}0a` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: AC2 }}>🕊️ {season.name}</span>
            <span style={{ fontSize: 12, color: T2, fontFamily: "monospace" }}>Day {seasonDay(rawSeason, logDs)} of {season.days}</span>
          </div>
          <div style={{ fontSize: 12, color: T2, lineHeight: 1.55 }}>{seasonTpl.framing}</div>
        </Card>
      )}
      {hardOn && hardEval && (() => {
        const done = !!days[logDs]?.completedAt;
        const f = hardEval.floors, tot = hardEval.totals;
        const bar = (label, val, lo, hi, unit) => {
          const ok = val >= lo && (hi == null || val <= hi);
          return (
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 3 }}>
                <span style={{ color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
                <span style={{ fontFamily: "monospace", color: ok ? GR : AC2 }}>{Math.round(val)}{unit} · floor {lo}{hi != null ? ` · ceil ${hi}` : ""}</span>
              </div>
              <div style={{ height: 4, background: BD, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, hi ? (val / hi) * 100 : (val / lo) * 100)}%`, background: ok ? GR : AC2 }} />
              </div>
            </div>
          );
        };
        return (
          <Card style={{ padding: "15px 17px", border: `1px solid ${AC2}55`, background: `${AC2}0a` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Lock size={13} color={AC2} />
              <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 800, color: AC2 }}>God Mode · {done ? "Day closed" : "Day open"}</span>
              {dayLocked && <span style={{ fontSize: 10.5, color: T3 }}>· locked from edits</span>}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
              {bar("Protein", tot.p, f.proteinFloor, null, "g")}
              {bar("Calories", tot.kcal, f.kcalFloor, f.kcalCeil, "")}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: T2, marginBottom: hardEval.canComplete || done ? 12 : 10 }}>
              <span>Post-shift meal: <b style={{ color: hardEval.postShiftLogged ? GR : AC2 }}>{hardEval.postShiftLogged ? "logged ✓" : "not yet"}</b></span>
              <span>Logged on time: <b style={{ color: hardEval.lateItems.length ? AC2 : GR }}>{hardEval.lateItems.length ? `${hardEval.lateItems.length} late` : "all ✓"}</b></span>
              <span>Sugared drinks: <b style={{ color: hardEval.capReached ? AC2 : T1 }}>{hardEval.sugaredCount}/{hard.sugaredCap}</b></span>
            </div>
            {/* Low-appetite path for the mandatory post-shift meal — never a skip. */}
            {!hardEval.postShiftLogged && !done && (
              <div style={{ padding: "10px 12px", background: B2, border: `1px solid ${BD}`, borderRadius: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 11.5, color: T2, marginBottom: 6, lineHeight: 1.5 }}>The post-shift meal is required. Low appetite? Log one of these instead of skipping:</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: T3, lineHeight: 1.7 }}>
                  {LOW_APPETITE_OPTIONS.slice(0, 3).map((o) => <li key={o}>{o}</li>)}
                </ul>
              </div>
            )}
            {done ? (
              <div style={{ fontSize: 12, color: days[logDs].clean ? GR : T2 }}>{days[logDs].clean ? "Clean day — logged, floors met, nothing late." : "Day completed."}</div>
            ) : hardEval.canComplete ? (
              <button onClick={markDayComplete} style={{ padding: "9px 18px", background: GR, border: "none", borderRadius: 10, color: "#04130a", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                Mark day complete{hardEval.clean ? " · clean" : ""}
              </button>
            ) : (
              // A failed/incomplete day states its one cause, neutrally. No alarm.
              <div style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>{hardEval.failReason}</div>
            )}
          </Card>
        );
      })()}
      <MotivePush context={["meal", "protein", "water"]} accent={GR} compact />
      {/* ── Daily dashboard — ring + macro bars, then water/sodium/score ── */}
      <Card style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <Ring pct={pctKcal} glow color={pctKcal > 115 ? AM : GR} size={104}>
            <div style={{ fontSize: 19, fontWeight: 900, color: T1, fontFamily: "'JetBrains Mono',monospace" }}>{Math.round(totals.kcal).toLocaleString()}</div>
            <div style={{ fontSize: 8, color: T3, letterSpacing: 1 }}>/ {targets.kcal.toLocaleString()} KCAL</div>
          </Ring>
          <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 8 }}>
            {[["Protein", totals.p, targets.p, AC2], ["Carbs", totals.c, targets.c, `${AC2}99`], ["Fat", totals.f, targets.f, `${AC2}99`], ["Fibre", totals.fib, targets.fib, `${AC2}99`]].map(([l, v, t, c]) => (
              <div key={l}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: T2 }}>{l}</span>
                  <span style={{ fontSize: 11, color: l === "Protein" ? AC2 : T2, fontFamily: "monospace" }}>{Math.round(v)} / {t} g</span>
                </div>
                <Meter pct={(v / t) * 100} height={5} color={c} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: T2, flexWrap: "wrap" }}>
          <span>Water <b style={{ color: T1 }}>{((totals.fluidMl || 0) / 1000).toFixed(1)}</b>/{(targets.waterMl / 1000).toFixed(1)} L</span>
          <span>Sodium <b style={{ color: totals.na > 2300 ? AM : T1 }}>{Math.round(totals.na || 0).toLocaleString()}</b> mg</span>
          <span style={{ marginLeft: "auto", color: score == null ? T3 : score >= 70 ? GR : score >= 50 ? AM : RE }}>Score {score == null ? "—" : score}</span>
        </div>
        {remainingP > 0 && (
          <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 9, background: `${AC2}0C`, border: `1px solid ${AC2}33`, fontSize: 11, color: T2, lineHeight: 1.5 }}>
            <b style={{ color: AC2 }}>{remainingP}g protein short</b>{emptyShiftSlots > 0 ? ` with ${emptyShiftSlots} meal${emptyShiftSlots === 1 ? "" : "s"} left` : ""}. {`${Math.max(1, Math.round(remainingP / 20))}× a palm of chicken/fish (~35g each), or ${Math.max(1, Math.round(remainingP / 6))} eggs + yoghurt, closes it.`}
          </div>
        )}
      </Card>

      {/* ── One-tap logging: frequent meals + copy yesterday ── */}
      {(frequents.length > 0 || (entries.length === 0 && dayEntries(log, daysAgoStr(1)).length > 0)) && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {frequents.length > 0 && <span style={{ fontSize: 9.5, color: T3, letterSpacing: 1.5, textTransform: "uppercase" }}>One tap</span>}
          {frequents.map((r) => (
            <button key={`${r.name}|${r.grams}`} onClick={() => logFrequent(r)} aria-label={`Log ${r.name}`}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: `${GR}10`, border: `1px solid ${GR}33`, borderRadius: 9, color: T1, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
              <span>{r.name}</span>
              <span style={{ fontSize: 9.5, color: T3, fontFamily: "monospace" }}>{r.grams > 0 ? `${r.grams}g · ` : ""}{Math.round(r.n.kcal || 0)} kcal</span>
            </button>
          ))}
          {entries.length === 0 && dayEntries(log, daysAgoStr(1)).length > 0 && (
            <button onClick={copyYesterday} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: GL, border: `1px solid ${CY}44`, borderRadius: 9, color: CY, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <Copy size={12} />Copy yesterday</button>
          )}
        </div>
      )}
      {/* Bump my calories — fast, low-effort adds to close a gap */}
      {quickAddFoods.length > 0 && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 9.5, color: T3, letterSpacing: 1.5, textTransform: "uppercase" }}>Bump my calories</span>
          {quickAddFoods.map((f) => (
            <button key={f.id} onClick={() => addEntry(newEntry(f, f.serving ? f.serving.g : 100, slotForNow(), nowTime()))} aria-label={`Add ${f.name}`}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: `${AM}10`, border: `1px solid ${AM}33`, borderRadius: 9, color: T1, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
              <span>{f.name}</span>
              <span style={{ fontSize: 9.5, color: T3, fontFamily: "monospace" }}>{Math.round((f.per100.kcal || 0) * (f.serving ? f.serving.g : 100) / 100)} kcal</span>
            </button>
          ))}
        </div>
      )}
      {/* Supplement adherence — checkmarks, not calories */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 9.5, color: T3, letterSpacing: 1.5, textTransform: "uppercase" }}>Supplements</span>
        {[["creatine", "Creatine 5g"], ["magnesium", "Magnesium"]].map(([id, label]) => (
          <button key={id} onClick={() => toggleSupp(id)} aria-pressed={!!suppsToday[id]}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", background: suppsToday[id] ? `${GR}12` : GL, border: `1px solid ${suppsToday[id] ? GR + "55" : BD}`, borderRadius: 9, color: suppsToday[id] ? GR : T2, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${suppsToday[id] ? GR : T3}`, background: suppsToday[id] ? GR : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{suppsToday[id] && <span style={{ color: "#04130a", fontSize: 10 }}>✓</span>}</span>
            {label}
          </button>
        ))}
      </div>
      {shownSlots.map((slot) => {
        const list = entries.filter((e) => e.slot === slot.id);
        const slotKcal = Math.round(list.reduce((s, e) => s + (+e.n.kcal || 0), 0));
        const slotP = Math.round(list.reduce((s, e) => s + (+e.n.p || 0), 0));
        return (
          <Card key={slot.id} style={{ padding: "12px 15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: list.length || adding === slot.id ? 10 : 0 }}>
              <span style={{ fontSize: 15 }}>{slot.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: list.length ? T1 : T3, flex: 1 }}>{slot.l}</span>
              {slotKcal > 0 && <span style={{ fontSize: 11.5, color: T2, fontFamily: "monospace" }}>{slotKcal.toLocaleString()} · {slotP}P</span>}
              <button onClick={() => (adding === slot.id ? closeAdd() : (closeAdd(), setAdding(slot.id)))} aria-label={`Add to ${slot.l}`}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 11px", background: adding === slot.id ? `${GR}18` : GL, border: `1px solid ${adding === slot.id ? GR + "55" : BD}`, borderRadius: 8, color: adding === slot.id ? GR : T2, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {adding === slot.id ? <ChevronUp size={12} /> : <Plus size={12} />}{adding === slot.id ? "Close" : "Add"}
              </button>
            </div>

            {list.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T1 }}>{e.name}{e.ai && <span title="AI estimate — approximate" style={{ color: CY, marginLeft: 5 }}>✦</span>}</div>
                  <div style={{ fontSize: 10, color: T3, fontFamily: "monospace" }}>{e.time ? `${e.time} · ` : ""}{Math.round(e.n.kcal || 0)} kcal · P{Math.round(e.n.p || 0)} C{Math.round(e.n.c || 0)} F{Math.round(e.n.f || 0)}</div>
                </div>
                {e.grams > 0 && (
                  <input type="number" inputMode="decimal" value={e.grams} onChange={(ev) => setGrams(e.id, ev.target.value)} aria-label={`Grams of ${e.name}`}
                    style={{ ...input, width: 64, padding: "5px 8px", fontSize: 11.5, fontFamily: "monospace", textAlign: "right" }} />
                )}
                {e.grams > 0 && <span style={{ fontSize: 10, color: T3 }}>g</span>}
                <button onClick={() => removeEntry(e.id)} aria-label={`Remove ${e.name}`} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 3 }}><Trash2 size={12} /></button>
              </div>
            ))}

            {adding === slot.id && (
              <div style={{ marginTop: 4, padding: "12px", background: `${GR}06`, border: `1px dashed ${BD}`, borderRadius: 10 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {[["search", "Search"], ["ai", "✦ AI estimate"], ["quick", "Quick add"], ["custom", "New food"], ["recipe", "Recipe"]].map(([m, l]) => (
                    <button key={m} onClick={() => (m === "custom" || m === "recipe" ? startCustom(m === "recipe") : (setMode(m), setCustom(null)))}
                      style={{ padding: "4px 11px", borderRadius: 13, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${(mode === m || (custom && ((m === "recipe") === !!custom.recipe) && mode === "custom")) ? GR + "55" : BD}`, background: mode === m ? `${GR}14` : GL, color: mode === m ? GR : T3 }}>
                      {l}
                    </button>
                  ))}
                  <span style={{ fontSize: 9.5, color: T3, alignSelf: "center", marginLeft: "auto" }}>Barcode & photo: future phase</span>
                </div>

                {mode === "search" && (
                  <>
                    {recents.length > 0 && !q && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                        {recents.map((r) => (
                          <button key={r.name} onClick={() => addRecent(r)} title={`Log again (${r.grams}g)`}
                            style={{ padding: "4px 10px", borderRadius: 12, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${CY}33`, background: `${CY}0D`, color: CY }}>
                            ↻ {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <Search size={12} color={T3} style={{ position: "absolute", left: 10, top: 9 }} />
                      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods… (★ favorites float to the top)"
                        style={{ ...input, width: "100%", paddingLeft: 28 }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 240, overflowY: "auto" }}>
                      {results.map(foodRow)}
                      {!results.length && <div style={{ fontSize: 11.5, color: T3, padding: "10px", textAlign: "center" }}>No match — create it under "New food".</div>}
                    </div>
                    {sel && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                        {/* Variant selector (e.g. plain / Greek / low-fat) — swaps macros live */}
                        {Array.isArray(sel.variants) && sel.variants.length > 0 && (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }} aria-label="Variant">
                            <span style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>Variant</span>
                            {sel.variants.map((v) => (
                              <button key={v.id} onClick={() => setVariant(v.id)} aria-label={`Variant ${v.l}`}
                                style={{ padding: "4px 10px", borderRadius: 12, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${variant === v.id ? GR + "66" : BD}`, background: variant === v.id ? `${GR}14` : GL, color: variant === v.id ? GR : T3 }}>{v.l}</button>
                            ))}
                          </div>
                        )}
                        {/* Portion multipliers: ½ / serving / 2× / 100g */}
                        {(() => {
                          const s = sel.serving;
                          const chips = [
                            ...(s ? [{ l: `½ · ${Math.round(s.g / 2)}g`, g: Math.round(s.g / 2) }, { l: `${s.l} · ${s.g}g`, g: s.g }, { l: `2× · ${s.g * 2}g`, g: s.g * 2 }] : []),
                            { l: "100 g", g: 100 },
                          ];
                          return (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }} aria-label="Serving size">
                              {chips.map((c) => (
                                <button key={c.l} onClick={() => setGramsInput(String(c.g))} aria-label={`Serving ${c.l}`}
                                  style={{ padding: "4px 10px", borderRadius: 12, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${+grams === c.g ? GR + "66" : BD}`, background: +grams === c.g ? `${GR}14` : GL, color: +grams === c.g ? GR : T3 }}>{c.l}</button>
                              ))}
                              {sel.bev && <span style={{ fontSize: 9.5, color: CY, alignSelf: "center" }}>💧 counts as fluid</span>}
                            </div>
                          );
                        })()}
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11.5, color: T2, flex: 1 }}>{selFood.name}</span>
                          <input type="number" inputMode="decimal" value={grams} onChange={(e) => setGramsInput(e.target.value)} aria-label="Portion in grams" autoFocus
                            style={{ ...input, width: 76, fontFamily: "monospace", textAlign: "right" }} />
                          <span style={{ fontSize: 10.5, color: T3 }}>g</span>
                          <button onClick={confirmAdd} style={{ padding: "7px 16px", background: `linear-gradient(135deg,${GR},#5fae7c)`, border: "none", borderRadius: 9, color: "#04130a", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Log it</button>
                        </div>
                        {/* Live macro preview at the chosen portion + variant */}
                        {(() => { const n = scaleNutrients(selFood.per100, +grams || 0); return (
                          <div style={{ fontSize: 10.5, color: T3, fontFamily: "monospace" }}>
                            {Math.round(n.kcal || 0)} kcal · P{Math.round(n.p || 0)} C{Math.round(n.c || 0)} F{Math.round(n.f || 0)}{n.na ? ` · Na ${Math.round(n.na)}mg` : ""}{sel.bev ? ` · ${Math.round(+grams || 0)}ml fluid` : ""}
                          </div>
                        ); })()}
                      </div>
                    )}
                  </>
                )}

                {mode === "ai" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {!getApiKey() ? (
                      <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.6, padding: "8px 10px", background: GL, border: `1px solid ${BD}`, borderRadius: 9 }}>
                        AI estimation uses your Anthropic API key — add it in <b style={{ color: T2 }}>Settings → Anthropic API Key</b> and this box comes alive.
                      </div>
                    ) : (
                      <>
                        <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} rows={2}
                          placeholder='Describe the meal… e.g. "2 chapatis with beef stew and a mug of chai"'
                          aria-label="Describe the meal"
                          style={{ ...input, width: "100%", resize: "none", lineHeight: 1.6 }} />
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <button onClick={runAiEstimate} disabled={!aiText.trim() || aiState.busy}
                            style={{ padding: "7px 15px", background: aiText.trim() && !aiState.busy ? `${CY}14` : GL, border: `1px solid ${aiText.trim() && !aiState.busy ? CY + "44" : BD}`, borderRadius: 9, color: aiText.trim() && !aiState.busy ? CY : T3, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            {aiState.busy ? "Estimating…" : "✦ Estimate nutrients"}
                          </button>
                          <span style={{ fontSize: 9.5, color: T3 }}>AI estimates are approximate — you confirm before it logs.</span>
                        </div>
                        {aiState.err && <div style={{ fontSize: 11.5, color: RE, lineHeight: 1.5 }}>{aiState.err}</div>}
                        {aiState.est && (
                          <div style={{ padding: "10px 12px", background: `${CY}08`, border: `1px solid ${CY}33`, borderRadius: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: T1, flex: 1 }}>✦ {aiState.est.name}{aiState.est.grams ? ` · ~${aiState.est.grams}g` : ""}</span>
                              <span style={{ fontSize: 11, color: T2, fontFamily: "monospace" }}>
                                {Math.round(aiState.est.n.kcal)} kcal · P{Math.round(aiState.est.n.p || 0)} C{Math.round(aiState.est.n.c || 0)} F{Math.round(aiState.est.n.f || 0)}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: T3, marginTop: 4 }}>
                              {["fib", "na", "k", "fe", "vc"].filter((k) => aiState.est.n[k] != null).map((k) => `${NUTRIENTS.find((x) => x.k === k).l} ${aiState.est.n[k]}${NUTRIENTS.find((x) => x.k === k).u}`).join(" · ") || "Macros only"}
                            </div>
                            <button onClick={logAiEstimate}
                              style={{ marginTop: 9, padding: "7px 16px", background: `linear-gradient(135deg,${GR},#5fae7c)`, border: "none", borderRadius: 9, color: "#04130a", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                              Log it
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {mode === "quick" && (
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                    <input value={quick.name} onChange={(e) => setQuick((s) => ({ ...s, name: e.target.value }))} placeholder="Name (optional)" style={{ ...input, flex: 1, minWidth: 120 }} />
                    {[["kcal", "kcal"], ["p", "P g"], ["c", "C g"], ["f", "F g"]].map(([k, ph]) => (
                      <input key={k} type="number" inputMode="decimal" value={quick[k]} onChange={(e) => setQuick((s) => ({ ...s, [k]: e.target.value }))} placeholder={ph} aria-label={ph}
                        style={{ ...input, width: 68, fontFamily: "monospace" }} />
                    ))}
                    <button onClick={saveQuick} disabled={!(+quick.kcal > 0)} style={{ padding: "8px 15px", background: +quick.kcal > 0 ? `${GR}14` : GL, border: `1px solid ${+quick.kcal > 0 ? GR + "44" : BD}`, borderRadius: 9, color: +quick.kcal > 0 ? GR : T3, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Log</button>
                  </div>
                )}

                {mode === "custom" && custom && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={custom.name} onChange={(e) => setCustom((s) => ({ ...s, name: e.target.value }))} placeholder={custom.recipe ? "Recipe name (e.g. My githeri mix)" : "Food name"} style={{ ...input, width: "100%" }} autoFocus />
                    {!custom.recipe && (
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        {[["kcal", "kcal/100g"], ["p", "P g"], ["c", "C g"], ["f", "F g"], ["fib", "Fiber g"], ["sug", "Sugar g"], ["na", "Sodium mg"]].map(([k, ph]) => (
                          <input key={k} type="number" inputMode="decimal" value={custom.per100[k] || ""} onChange={(e) => setCustom((s) => ({ ...s, per100: { ...s.per100, [k]: e.target.value } }))} placeholder={ph} aria-label={ph}
                            style={{ ...input, width: 86, fontFamily: "monospace" }} />
                        ))}
                      </div>
                    )}
                    {custom.recipe && (
                      <>
                        <input value={custom.iq} onChange={(e) => setCustom((s) => ({ ...s, iq: e.target.value }))} placeholder="Search an ingredient…" style={{ ...input, width: "100%" }} />
                        {custom.iq.trim() && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 130, overflowY: "auto" }}>
                            {allFoods.filter((f) => f.name.toLowerCase().includes(custom.iq.trim().toLowerCase())).slice(0, 5).map((f) => (
                              <button key={f.id} onClick={() => setCustom((s) => ({ ...s, iq: "", items: [...s.items, { food: f, grams: 100 }] }))}
                                style={{ padding: "6px 10px", background: GL, border: `1px solid ${BD}`, borderRadius: 8, color: T2, fontSize: 11.5, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>+ {f.name}</button>
                            ))}
                          </div>
                        )}
                        {custom.items.map((it, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ flex: 1, fontSize: 11.5, color: T1 }}>{it.food.name}</span>
                            <input type="number" inputMode="decimal" value={it.grams} onChange={(e) => setCustom((s) => ({ ...s, items: s.items.map((x, j) => j === i ? { ...x, grams: +e.target.value || 0 } : x) }))}
                              aria-label={`Grams of ${it.food.name}`} style={{ ...input, width: 64, fontFamily: "monospace", textAlign: "right" }} />
                            <span style={{ fontSize: 10, color: T3 }}>g</span>
                            <button onClick={() => setCustom((s) => ({ ...s, items: s.items.filter((_, j) => j !== i) }))} aria-label={`Remove ${it.food.name}`} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><Trash2 size={11} /></button>
                          </div>
                        ))}
                      </>
                    )}
                    <button onClick={saveCustom} style={{ alignSelf: "flex-start", padding: "7px 15px", background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 9, color: GR, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Save {custom.recipe ? "recipe" : "food"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {/* ── Today's quality analysis ── */}
      {entries.length > 0 && (
        <Card style={{ padding: "16px 18px" }}>
          <SH title="Meal Quality" sub="What today's food says — and the one next move" />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 9, padding: "8px 11px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, fontSize: 12, color: T2, lineHeight: 1.5 }}>
                <span>{s.icon}</span><span>{s.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Training link (Gym facet) ── */}
      {(() => {
        const rowIcon = (on) => on ? <Check size={13} color={GR} /> : <CircleDashed size={13} color={T3} />;
        const proteinTarget = targets.p + gym.proteinBump;
        return (
          <Card style={{ padding: "13px 16px", border: `1px solid ${gym.connected ? (gym.trainedToday ? GR + "44" : AC2 + "33") : BD}`, background: gym.trainedToday ? `${GR}08` : "transparent" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              {gym.connected ? <Link2 size={14} color={gym.trainedToday ? GR : AC2} /> : <Dumbbell size={14} color={T3} />}
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T1, flex: 1 }}>Training link</span>
              <span style={{ fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", padding: "2px 7px", borderRadius: 5, border: `1px solid ${gym.connected ? (gym.trainedToday ? GR + "55" : AC2 + "44") : BD}`, color: gym.connected ? (gym.trainedToday ? GR : AC2) : T3 }}>
                {gym.connected ? (gym.trainedToday ? "Trained today" : "Connected") : "Not connected"}
              </span>
            </div>
            {gym.connected ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T2 }}>
                  {rowIcon(gym.trainedToday)}<span style={{ flex: 1 }}>Training-day calorie allowance</span>
                  <span style={{ color: gym.trainedToday ? GR : T3, fontFamily: "monospace" }}>{gym.trainedToday ? `+${gym.kcalShift} · ${(targets.kcal + gym.kcalShift).toLocaleString()}` : `+${300} when active`}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T2 }}>
                  {rowIcon(gym.trainedToday)}<span style={{ flex: 1 }}>Protein target on a session day</span>
                  <span style={{ color: gym.trainedToday ? GR : T3, fontFamily: "monospace" }}>{gym.trainedToday ? `${proteinTarget} g` : "awaiting"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T2 }}>
                  {rowIcon(gym.trainedToday)}<span style={{ flex: 1 }}>Post-session fuel window</span>
                  <span style={{ color: gym.trainedToday ? GR : T3, fontFamily: "monospace" }}>{gym.trainedToday ? "next 2 h" : "awaiting"}</span>
                </div>
                {!gym.trainedToday && gym.lastDate && (
                  <div style={{ fontSize: 10, color: T3, marginTop: 2 }}>No session logged for this day · last was {gym.lastDate}. Fuel adjusts automatically when you train.</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: T3, lineHeight: 1.5 }}>Log a workout in the Gym facet and Fuel connects automatically — training days get a calorie allowance and a protein bump.</div>
            )}
          </Card>
        );
      })()}

      {/* ── XP earned today (nutrition) ── */}
      {entries.length > 0 && (() => {
        // Mirrors the XP engine's value table (display only): meal day 10,
        // protein hit 10, healthy day 15, a logged gym session 30.
        const proteinHit = totals.p >= targets.p;
        const healthy = score != null && score >= 70;
        const rows = [
          { on: entries.length > 0, label: "Logged meals", xp: 10 },
          { on: proteinHit, label: "Protein target hit", xp: 10 },
          { on: healthy, label: "Within calorie band", xp: 15 },
          { on: gym.trainedToday, label: "Gym session", xp: 30, needsGym: !gym.trainedToday },
        ];
        const earned = rows.filter((r) => r.on).reduce((s, r) => s + r.xp, 0);
        const total = rows.reduce((s, r) => s + r.xp, 0);
        return (
          <Card style={{ padding: "13px 16px" }}>
            <SH title="XP earned today" sub="Fuel's contribution to the day's score" action={<Flame size={13} color={AC2} />} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
              {rows.map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                  {r.on ? <Check size={13} color={GR} /> : r.needsGym ? <Lock size={12} color={T3} /> : <CircleDashed size={13} color={T3} />}
                  <span style={{ flex: 1, color: r.on ? T1 : T2 }}>{r.label}</span>
                  <span style={{ fontFamily: "monospace", color: r.on ? AC2 : r.needsGym ? T3 : T3, fontSize: 11 }}>{r.needsGym ? "locked · needs gym" : `+${r.xp}`}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1, height: 4, background: "#241F18", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: 4, width: `${Math.round((earned / total) * 100)}%`, background: AC2, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 10, color: T2, fontFamily: "monospace" }}>{earned} / {total} XP</span>
            </div>
          </Card>
        );
      })()}

      {/* ── Composition ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[
          { l: "Weight", v: curWeight == null ? "—" : curWeight.toFixed(1), u: "", d: wDelta == null ? null : `${wDelta <= 0 ? "" : "+"}${wDelta} / 2wk`, good: wDelta != null && (profile.goal === "cut" || profile.goal === "fatloss" ? wDelta < 0 : wDelta >= 0) },
          { l: "Waist", v: curWaist == null ? "—" : curWaist, u: "cm", d: waistDelta == null ? null : `${waistDelta <= 0 ? "" : "+"}${waistDelta} cm`, good: waistDelta != null && waistDelta < 0 },
          { l: "Target", v: targetWeight == null ? "—" : targetWeight, u: "kg", d: null },
        ].map((m) => (
          <div key={m.l} style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 12, padding: "11px 13px" }}>
            <div style={{ fontSize: 9, color: T3, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 6 }}>{m.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T1, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{m.v}{m.u && <span style={{ fontSize: 11, color: T3 }}>{m.u}</span>}</div>
            {m.d && <div style={{ fontSize: 9.5, color: m.good ? GR : T3, marginTop: 5 }}>{m.good ? "▼ " : ""}{m.d}</div>}
          </div>
        ))}
      </div>

      {report30.deficiencies.length > 0 && (
        <div style={{ padding: "10px 12px", borderRadius: 10, background: `${AM}0C`, border: `1px solid ${AM}33`, fontSize: 11, color: T2, lineHeight: 1.6 }}>
          <b style={{ color: AM }}>Running low (30d):</b> {report30.deficiencies.slice(0, 4).map((d) => `${d.l} ${d.cov}%`).join(" · ")}
        </div>
      )}

      {loggedDays30 < 28 && (
        <div style={{ padding: "10px 12px", borderRadius: 10, background: `${RE}0A`, border: `1px solid ${RE}33`, fontSize: 11, color: T2, lineHeight: 1.6 }}>
          <b style={{ color: RE }}>Logging gap:</b> {loggedDays30} of 30 days logged{avgKcal30 ? `, averaging ${avgKcal30.toLocaleString()} kcal` : ""}. Either intake is well under target or days are going unlogged — the two need opposite fixes.
        </div>
      )}

      {/* ── Micronutrients ── */}
      {entries.length > 0 && (
        <Collapse id="nutri_micros" title="Micronutrients" sub="today's coverage of daily targets">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
            {MICROS.map((k) => {
              const def = NUTRIENTS.find((n) => n.k === k);
              const cov = coverage(totals, k) || 0;
              return (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10.5, color: T2 }}>{def.l}</span>
                    <span style={{ fontSize: 10.5, color: cov >= 60 ? GR : T3, fontFamily: "monospace" }}>{Math.round(totals[k] * 10) / 10}{def.u} · {cov}%</span>
                  </div>
                  <Meter pct={cov} height={4} color={cov >= 60 ? GR : cov >= 30 ? AM : RE} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 11, color: T3 }}>
            <span>Sodium <b style={{ color: totals.na > 2300 ? RE : T2, fontFamily: "monospace" }}>{Math.round(totals.na)}mg</b>/2300</span>
            <span>Sugar <b style={{ color: totals.sug > 50 ? RE : T2, fontFamily: "monospace" }}>{Math.round(totals.sug)}g</b>/50</span>
            <span>Sat. fat <b style={{ color: totals.sat > 22 ? RE : T2, fontFamily: "monospace" }}>{Math.round(totals.sat)}g</b>/22</span>
            <span>Cholesterol <b style={{ color: totals.chol > 300 ? RE : T2, fontFamily: "monospace" }}>{Math.round(totals.chol)}mg</b>/300</span>
            <span>Net carbs <b style={{ color: T2, fontFamily: "monospace" }}>{totals.netC}g</b></span>
            <span>Unsat. fat <b style={{ color: T2, fontFamily: "monospace" }}>{totals.unsat}g</b></span>
            <span>Food water <b style={{ color: T2, fontFamily: "monospace" }}>{Math.round(totals.h2o)}g</b></span>
          </div>
        </Collapse>
      )}

      {/* ── Goals ── */}
      <Collapse id="nutri_goals" title="Goals & Profile" sub={`${GOALS.find((g) => g.id === profile.goal)?.l} · ${targets.kcal} kcal · ${targets.p}g protein · ~${(targets.waterMl / 1000).toFixed(1)}L water`}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {GOALS.map((g) => (
            <button key={g.id} onClick={() => setProfile((prev) => ({ ...sanitizeProfile(prev), goal: g.id }))}
              style={{ padding: "5px 12px", borderRadius: 14, fontSize: 11, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${profile.goal === g.id ? GR + "55" : BD}`, background: profile.goal === g.id ? `${GR}14` : GL, color: profile.goal === g.id ? GR : T3 }}>
              {g.l}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          {[["age", "Age"], ["heightCm", "Height cm"], ["weightKg", "Weight kg"], ["targetWeightKg", "Target kg"]].map(([k, l]) => (
            <NumField key={k} label={l} value={profile[k]}
              onCommit={(v) => setProfile((prev) => ({ ...sanitizeProfile(prev), [k]: v }))} />
          ))}
          <label style={{ fontSize: 10, color: T3, display: "flex", flexDirection: "column", gap: 3 }}>Sex
            <select value={profile.sex} onChange={(e) => setProfile((prev) => ({ ...sanitizeProfile(prev), sex: e.target.value }))} style={{ ...input, width: 96 }}>
              <option value="male">Male</option><option value="female">Female</option>
            </select>
          </label>
          <label style={{ fontSize: 10, color: T3, display: "flex", flexDirection: "column", gap: 3 }}>Activity
            <select value={profile.activity} onChange={(e) => setProfile((prev) => ({ ...sanitizeProfile(prev), activity: +e.target.value }))} style={{ ...input, width: 170 }}>
              {ACTIVITY.map((a) => <option key={a.id} value={a.id}>{a.l}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          <Chip label="Calories" value={targets.kcal.toLocaleString()} color={GR} />
          <Chip label="Protein" value={`${targets.p}g`} color={CY} />
          <Chip label="Carbs" value={`${targets.c}g`} color={PU} />
          <Chip label="Fat" value={`${targets.f}g`} color={AM} />
          <Chip label="Fiber" value={`${targets.fib}g`} color={GR} />
        </div>
        <div style={{ fontSize: 10.5, color: T3, marginTop: 9, lineHeight: 1.6 }}>
          Targets auto-calculate from your profile (Mifflin-St Jeor). Database values are honest approximations per 100 g — trends matter more than lab precision.
        </div>
      </Collapse>

      {/* ── Trends ── */}
      {Object.keys(log).length > 0 && (
        <Card style={{ padding: "16px 18px" }}>
          <SH title="Trends" sub="Calories · nutrition score — last 14 days" />
          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={series} margin={{ top: 4, right: -12, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BD} />
              <XAxis dataKey="label" stroke={T3} fontSize={9.5} tickLine={false} axisLine={false} />
              <YAxis yAxisId="l" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" stroke={T3} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip content={mkTT("")} />
              <Line yAxisId="l" type="monotone" dataKey="kcal" name="kcal" stroke={GR} strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="r" type="monotone" dataKey="score" name="score" stroke={AM} strokeWidth={1.5} dot={{ fill: AM, r: 2 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Reports ── */}
      {[["nutri_rep7", "Weekly Report", report7], ["nutri_rep30", "Monthly Report", report30]].map(([id, title, r]) => (
        <Collapse key={id} id={id} title={title} sub={r.logged ? `${r.logged} day${r.logged > 1 ? "s" : ""} logged · avg score ${r.avgScore}` : "no data yet"}>
          {!r.logged ? (
            <div style={{ fontSize: 12, color: T3, padding: "8px 0" }}>Log a few days and the report writes itself.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
                <Chip label="Avg calories" value={r.avgKcal.toLocaleString()} color={GR} />
                <Chip label="Avg protein" value={`${r.avgP}g`} color={CY} />
                <Chip label="Split P/C/F" value={`${r.split.p}/${r.split.c}/${r.split.f}`} color={PU} />
                <Chip label="Protein days" value={`${r.proteinHitPct}%`} color={GR} />
                <Chip label="Avg meals/day" value={r.avgMeals} color={T2} />
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11.5, color: T2 }}>
                {r.best && <span>Best day: <b style={{ color: GR, fontFamily: "monospace" }}>{r.best.ds.slice(5)} ({r.best.score})</b></span>}
                {r.worst && <span>Toughest: <b style={{ color: AM, fontFamily: "monospace" }}>{r.worst.ds.slice(5)} ({r.worst.score})</b></span>}
              </div>
              {r.topFoods.length > 0 && (
                <div style={{ fontSize: 11.5, color: T2 }}>Most eaten: {r.topFoods.map(([n, c]) => `${n} (${c}×)`).join(" · ")}</div>
              )}
              {r.deficiencies.length > 0 && (
                <div style={{ padding: "9px 12px", background: `${AM}0A`, border: `1px solid ${AM}33`, borderRadius: 9, fontSize: 11.5, color: T2, lineHeight: 1.6 }}>
                  <b style={{ color: AM }}>Running low:</b> {r.deficiencies.map((d) => `${d.l} (${d.cov}%)`).join(" · ")}
                </div>
              )}
            </div>
          )}
        </Collapse>
      ))}

      {entries.length === 0 && Object.keys(log).length === 0 && (
        <Empty icon="🍽️" title="Nothing logged yet" sub="Tap Add on any meal above — search a food, portion it in grams, done in under 10 seconds." />
      )}
    </div>
  );
}
