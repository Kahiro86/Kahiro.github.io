// ── Nutrition tab (Athlete OS) ───────────────────────────────────────
// Log fast, learn slow: a sub-10-second meal logger on top of the
// nutrition engine's full analysis. Water reads the Life OS Hydration
// wellness habit — one hydration tracker across the whole app.
import { useMemo, useState } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Star, Search, Copy, ChevronUp, Flame } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip, Meter, Empty } from "../../shared/ui.jsx";
import { Collapse } from "../../shared/Collapse.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { Ring } from "../../shared/charts.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import { migrateHabits, isWellness, valueOn } from "../../shared/habitEngine.js";
import { callClaude, getApiKey } from "../../shared/anthropic.js";
import {
  FOOD_DB, SLOTS, GOALS, ACTIVITY, NUTRIENTS, MICROS, DEFAULT_PROFILE,
  sanitizeNutrition, sanitizeFoods, sanitizeProfile, calcTargets,
  newEntry, scaleNutrients, dayTotals, dayEntries, coverage,
  nutritionScore, qualitySuggestions, nutritionSeries, healthyStreaks, nutritionReport,
  AI_MEAL_SYSTEM, parseAiEstimate,
} from "./nutrition.js";

const input = { background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const nowTime = () => new Date().toTimeString().slice(0, 5);

export function NutritionTab() {
  const [rawLog, setLog] = useStorageState("nutrition_log", {});
  const [rawFoods, setFoods] = useStorageState("nutrition_foods", []);
  const [rawProfile, setProfile] = useStorageState("nutrition_profile", DEFAULT_PROFILE);
  const [rawHabits] = useStorageState("habits", []);
  const toast = useToast();
  const today = localDateStr();

  const log = useMemo(() => sanitizeNutrition(rawLog), [rawLog]);
  const customFoods = useMemo(() => sanitizeFoods(rawFoods), [rawFoods]);
  const profile = useMemo(() => sanitizeProfile(rawProfile), [rawProfile]);
  const targets = useMemo(() => calcTargets(profile), [profile]);

  const entries = dayEntries(log, today);
  const totals = useMemo(() => dayTotals(entries), [entries]);
  const score = nutritionScore(totals, targets);
  const suggestions = useMemo(() => qualitySuggestions(totals, targets, entries), [totals, targets, entries]);
  const streaks = useMemo(() => healthyStreaks(log, targets, today), [log, targets, today]);
  const series = useMemo(() => nutritionSeries(log, targets, 14), [log, targets]);
  const report7 = useMemo(() => nutritionReport(log, targets, 7), [log, targets]);
  const report30 = useMemo(() => nutritionReport(log, targets, 30), [log, targets]);

  // Hydration from the shared wellness habit — never a second water store.
  const water = useMemo(() => {
    const h = migrateHabits(rawHabits).find((x) => x && !x.archived && isWellness(x) && /hydra|water/i.test(x.name || ""));
    if (!h) return null;
    return { done: valueOn(h, today), target: h.target || 2, unit: h.unit || "L" };
  }, [rawHabits, today]);

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

  // ── Mutations (always via sanitize → the log can never go bad) ──────
  const writeDay = (ds, fn) => setLog((prev) => {
    const clean = sanitizeNutrition(prev);
    const next = fn(clean[ds] || []);
    const out = { ...clean };
    if (next.length) out[ds] = next; else delete out[ds];
    return out;
  });
  const addEntry = (entry) => {
    writeDay(today, (list) => [...list, entry]);
    toast(`${entry.name} logged · ${Math.round(entry.n.kcal || 0)} kcal`, { tone: "success", duration: 2200 });
  };
  const removeEntry = (id) => {
    const e = entries.find((x) => x.id === id);
    writeDay(today, (list) => list.filter((x) => x.id !== id));
    if (e) toast(`${e.name} removed`, { action: "Undo", onAction: () => writeDay(today, (l) => [...l, e]), tone: "danger" });
  };
  // Edit grams → nutrients recompute from the source food when known,
  // otherwise scale the stored values proportionally.
  const setGrams = (id, grams) => writeDay(today, (list) => list.map((e) => {
    if (e.id !== id) return e;
    const g = Math.max(0, +grams || 0);
    const src = allFoods.find((f) => f.name === e.name);
    const n = src ? scaleNutrients(src.per100, g) : (e.grams > 0 ? Object.fromEntries(Object.entries(e.n).map(([k, v]) => [k, Math.round((v / e.grams) * g * 10) / 10])) : e.n);
    return { ...e, grams: g, n };
  }));
  const copyYesterday = () => {
    const prev = dayEntries(log, daysAgoStr(1));
    if (!prev.length) { toast("Nothing logged yesterday", { tone: "info" }); return; }
    writeDay(today, (list) => [...list, ...prev.map((e) => ({ ...e, id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}` }))]);
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
  const [grams, setGramsInput] = useState("100");
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

  const closeAdd = () => { setAdding(null); setSel(null); setQ(""); setMode("search"); setCustom(null); setAiState({ busy: false, est: null, err: null }); };

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
    if (!sel || !(+grams > 0)) return;
    addEntry(newEntry(sel, +grams, adding, nowTime()));
    setSel(null); setQ("");
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
    const food = { id: `cf${Date.now().toString(36)}`, name: custom.name.trim(), per100, proc };
    setFoods((prev) => [food, ...sanitizeFoods(prev)]);
    setSel(food); setMode("search"); setCustom(null);
    toast(`${custom.recipe ? "Recipe" : "Food"} saved — set the portion to log it`, { tone: "success" });
  };

  const pctKcal = targets.kcal ? Math.round((totals.kcal / targets.kcal) * 100) : 0;
  const remaining = Math.max(0, Math.round(targets.kcal - totals.kcal));
  const remainingP = Math.max(0, Math.round(targets.p - totals.p));
  const times = entries.map((e) => e.time).filter(Boolean).sort();
  const macroKcal = totals.p * 4 + totals.c * 4 + totals.f * 9 || 1;

  const foodRow = (f) => (
    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: sel?.id === f.id ? `${GR}12` : GL, border: `1px solid ${sel?.id === f.id ? GR + "44" : BD}`, borderRadius: 9 }}>
      <button onClick={() => { setSel(f); setGramsInput(String(f.id.startsWith("db_olive") ? 15 : 100)); }} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, color: T1 }}>{f.name}</span>
        <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace", whiteSpace: "nowrap" }}>{Math.round(f.per100.kcal || 0)} kcal · {Math.round(f.per100.p || 0)}g P /100g</span>
      </button>
      <button onClick={() => toggleFav(f.id)} aria-label={`Favorite ${f.name}`} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 }}>
        <Star size={12} color={profile.favs.includes(f.id) ? AM : T3} fill={profile.favs.includes(f.id) ? AM : "none"} />
      </button>
    </div>
  );

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      {/* ── Daily dashboard ── */}
      <Card style={{ padding: "20px 22px", background: `linear-gradient(180deg,${GR}08,transparent)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <Ring pct={pctKcal} glow color={pctKcal > 115 ? AM : GR} size={116}>
            <div style={{ fontSize: 21, fontWeight: 900, color: T1, fontFamily: "'JetBrains Mono',monospace" }}>{Math.round(totals.kcal)}</div>
            <div style={{ fontSize: 8.5, color: T3, letterSpacing: 1 }}>/ {targets.kcal} KCAL</div>
          </Ring>
          <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 9 }}>
            {[["Protein", totals.p, targets.p, GR], ["Carbs", totals.c, targets.c, CY], ["Fat", totals.f, targets.f, AM], ["Fiber", totals.fib, targets.fib, PU]].map(([l, v, t, c]) => (
              <div key={l}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{l}</span>
                  <span style={{ fontSize: 11, color: T2, fontFamily: "monospace" }}>{Math.round(v)} / {t}g</span>
                </div>
                <Meter pct={(v / t) * 100} height={4} color={c} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, color: T2, minWidth: 150 }}>
            <span>Remaining: <b style={{ color: GR, fontFamily: "monospace" }}>{remaining} kcal</b> · <b style={{ color: GR, fontFamily: "monospace" }}>{remainingP}g P</b></span>
            <span>Score: <b style={{ color: score == null ? T3 : score >= 70 ? GR : score >= 50 ? AM : RE, fontFamily: "monospace" }}>{score == null ? "—" : `${score}/100`}</b></span>
            <span>Macro split: <b style={{ fontFamily: "monospace", color: T1 }}>{Math.round((totals.p * 4 / macroKcal) * 100)}/{Math.round((totals.c * 4 / macroKcal) * 100)}/{Math.round((totals.f * 9 / macroKcal) * 100)}</b> <span style={{ color: T3 }}>P/C/F</span></span>
            <span>{entries.length} meal item{entries.length === 1 ? "" : "s"}{entries.length ? ` · avg ${Math.round(totals.kcal / entries.length)} kcal` : ""}{times.length ? ` · ${times[0]}–${times[times.length - 1]}` : ""}</span>
            {water && <span>Water: <b style={{ color: CY, fontFamily: "monospace" }}>{water.done}/{water.target}{water.unit}</b> <span style={{ color: T3 }}>(Life OS)</span></span>}
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: AM }}><Flame size={11} />{streaks.current}d healthy streak · best {streaks.best}d</span>
          </div>
        </div>
      </Card>

      {/* ── Meal slots ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {entries.length === 0 && dayEntries(log, daysAgoStr(1)).length > 0 && (
          <button onClick={copyYesterday} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: GL, border: `1px solid ${CY}44`, borderRadius: 9, color: CY, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <Copy size={12} />Copy yesterday</button>
        )}
      </div>
      {SLOTS.map((slot) => {
        const list = entries.filter((e) => e.slot === slot.id);
        const slotKcal = Math.round(list.reduce((s, e) => s + (+e.n.kcal || 0), 0));
        return (
          <Card key={slot.id} style={{ padding: "13px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: list.length || adding === slot.id ? 10 : 0 }}>
              <span style={{ fontSize: 15 }}>{slot.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T1, flex: 1 }}>{slot.l}</span>
              {slotKcal > 0 && <span style={{ fontSize: 11.5, color: T3, fontFamily: "monospace" }}>{slotKcal} kcal</span>}
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
                  <input type="number" value={e.grams} onChange={(ev) => setGrams(e.id, ev.target.value)} aria-label={`Grams of ${e.name}`}
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
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                        <span style={{ fontSize: 11.5, color: T2, flex: 1 }}>{sel.name}</span>
                        <input type="number" value={grams} onChange={(e) => setGramsInput(e.target.value)} aria-label="Portion in grams" autoFocus
                          style={{ ...input, width: 76, fontFamily: "monospace", textAlign: "right" }} />
                        <span style={{ fontSize: 10.5, color: T3 }}>g = {Math.round((sel.per100.kcal || 0) * (+grams || 0) / 100)} kcal</span>
                        <button onClick={confirmAdd} style={{ padding: "7px 16px", background: `linear-gradient(135deg,${GR},#5fae7c)`, border: "none", borderRadius: 9, color: "#04130a", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Log it</button>
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
                      <input key={k} type="number" value={quick[k]} onChange={(e) => setQuick((s) => ({ ...s, [k]: e.target.value }))} placeholder={ph} aria-label={ph}
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
                          <input key={k} type="number" value={custom.per100[k] || ""} onChange={(e) => setCustom((s) => ({ ...s, per100: { ...s.per100, [k]: e.target.value } }))} placeholder={ph} aria-label={ph}
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
                            <input type="number" value={it.grams} onChange={(e) => setCustom((s) => ({ ...s, items: s.items.map((x, j) => j === i ? { ...x, grams: +e.target.value || 0 } : x) }))}
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
          {[["age", "Age"], ["heightCm", "Height cm"], ["weightKg", "Weight kg"]].map(([k, l]) => (
            <label key={k} style={{ fontSize: 10, color: T3, display: "flex", flexDirection: "column", gap: 3 }}>{l}
              <input type="number" value={profile[k]} onChange={(e) => setProfile((prev) => ({ ...sanitizeProfile(prev), [k]: +e.target.value || 0 }))}
                style={{ ...input, width: 84, fontFamily: "monospace" }} />
            </label>
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
          <SH title="Trends" sub="Calories (bars) · nutrition score (line) — last 14 days" />
          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={series} margin={{ top: 4, right: -12, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BD} />
              <XAxis dataKey="label" stroke={T3} fontSize={9.5} tickLine={false} axisLine={false} />
              <YAxis yAxisId="l" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" orientation="right" stroke={T3} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip content={mkTT("")} />
              <Bar yAxisId="l" dataKey="kcal" name="kcal" fill={GR} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
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
