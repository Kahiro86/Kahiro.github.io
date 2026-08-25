// Floating quick-log: log the day's habits and meals from anywhere. The button
// itself is a live progress ring for the day's habits.
//
// Meals use a two-step "select-then-add" flow: pick a MEAL TYPE, then add foods
// (ordered by what you usually eat in that slot, the full library searchable
// underneath); entries land under that meal type so the day's log groups by
// type. The meal-type select defaults to UNSELECTED so nothing is mislogged.
import { useState, useMemo, useEffect } from "react";
import { Zap, Check, X, Utensils, Copy, Search, Trash2 } from "lucide-react";
import { B1, B2, BD, BD2, T1, T3, GL, CY, GR, AM } from "./designTokens.js";
import { localDateStr, daysAgoStr } from "./dates.js";
import { isScheduled, isDone, isSkipped, valueOn } from "./habitEngine.js";
import { useStorageState } from "./useStorageState.js";
import { useToast } from "./toast.jsx";
import { sanitizeNutrition, sanitizeFoods, dayEntries, newEntry, FOOD_DB, SLOTS } from "../modules/athlete/nutrition.js";

const nowTime = () => new Date().toTimeString().slice(0, 5);
const rid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;

// The user's most-logged foods in a given slot over the last N days — the
// "relevant first" ordering is grounded in real behaviour, not guessed tags.
function slotRegulars(log, slot, days = 30, limit = 6) {
  const seen = new Map();
  for (let i = 0; i < days; i++) {
    for (const e of dayEntries(log, daysAgoStr(i))) {
      if (e.slot !== slot) continue;
      const key = `${e.name}|${e.grams}`;
      const cur = seen.get(key);
      if (cur) cur.count++;
      else seen.set(key, { name: e.name, grams: e.grams, proc: e.proc, n: e.n, count: 1 });
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

const SectionHead = ({ icon, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "14px 0 7px", fontSize: 9.5, color: T3, letterSpacing: 1.5, textTransform: "uppercase" }}>
    {icon}{children}
  </div>
);

const selStyle = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", cursor: "pointer", boxSizing: "border-box" };

export function QuickLog({ habits, onTap, hidden, offsetRight = 24, openSignal = 0 }) {
  const [open, setOpen] = useState(false);
  const ds = localDateStr();
  const toast = useToast();

  const [rawLog, setLog] = useStorageState("nutrition_log", {});
  const [rawFoods] = useStorageState("nutrition_foods", []);
  const log = useMemo(() => sanitizeNutrition(rawLog), [rawLog]);
  const customFoods = useMemo(() => sanitizeFoods(rawFoods), [rawFoods]);

  const [mealSlot, setMealSlot] = useState("");
  const [foodQ, setFoodQ] = useState("");

  // Full searchable food library — quick-add bumps ordered first, then the
  // rest. Kept above any early return so hook order stays stable.
  const library = useMemo(() => [...customFoods, ...FOOD_DB], [customFoods]);
  const foodMatches = useMemo(() => {
    const q = foodQ.trim().toLowerCase();
    const base = library.filter((f) => !q || f.name.toLowerCase().includes(q));
    const isQuick = (f) => Array.isArray(f.tags) && f.tags.includes("QUICK-ADD");
    return base
      .slice()
      .sort((a, b) => (isQuick(b) ? 1 : 0) - (isQuick(a) ? 1 : 0) || a.name.localeCompare(b.name))
      .slice(0, q ? 30 : 24);
  }, [library, foodQ]);

  // The command palette can open the sheet from anywhere (openSignal ticks up).
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);

  // Escape closes it. Without this the only way out is hitting the backdrop
  // exactly, and an overlay that is hard to dismiss is worse than no overlay.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const scheduled = habits.filter((h) => !h.archived && !h.paused && isScheduled(h, ds));
  // NOTE: every hook must run above this line — no hooks after an early return.
  if (!scheduled.length) return null;
  if (hidden && !open) return null;

  const done = scheduled.filter((h) => isDone(h, ds));
  const pct = Math.round((done.length / scheduled.length) * 100);
  const remaining = scheduled.filter((h) => !isDone(h, ds) && !isSkipped(h, ds));

  // ── Meals ──────────────────────────────────────────────────────────
  const yesterdayMeals = dayEntries(log, daysAgoStr(1));
  const regulars = mealSlot ? slotRegulars(log, mealSlot) : [];
  const todaySlotEntries = dayEntries(log, ds).filter((e) => e.slot === mealSlot);
  const slotLabel = SLOTS.find((s) => s.id === mealSlot)?.l || "";

  const pushEntry = (entry) => {
    setLog((prev) => { const p = sanitizeNutrition(prev); return { ...p, [ds]: [...(p[ds] || []), entry] }; });
    toast(`${entry.name} → ${slotLabel}`, { tone: "success", action: "Undo", onAction: () => setLog((prev) => { const p = sanitizeNutrition(prev); return { ...p, [ds]: (p[ds] || []).filter((e) => e.id !== entry.id) }; }) });
  };
  const addFood = (food) => { if (!mealSlot) return; pushEntry(newEntry(food, food.serving?.g || 100, mealSlot, nowTime())); };
  const addRegular = (r) => { if (!mealSlot) return; pushEntry({ id: rid("m"), slot: mealSlot, time: nowTime(), name: r.name, grams: r.grams, proc: r.proc, n: r.n }); };
  const removeSlotEntry = (id) => setLog((prev) => { const p = sanitizeNutrition(prev); return { ...p, [ds]: (p[ds] || []).filter((e) => e.id !== id) }; });
  const copyYesterday = () => {
    if (!yesterdayMeals.length) return;
    const clones = yesterdayMeals.map((e, i) => ({ ...e, id: rid(`m${i}`) }));
    const ids = new Set(clones.map((cl) => cl.id));
    setLog((prev) => { const p = sanitizeNutrition(prev); return { ...p, [ds]: [...(p[ds] || []), ...clones] }; });
    toast(`Copied ${clones.length} item${clones.length > 1 ? "s" : ""} from yesterday`, { tone: "success", action: "Undo", onAction: () => setLog((prev) => { const p = sanitizeNutrition(prev); return { ...p, [ds]: (p[ds] || []).filter((e) => !ids.has(e.id)) }; }) });
  };

  const size = 52, stroke = 3.5, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const row = { display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" };

  return (
    <>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 88 }} />}
      {open && (
        <div data-quicklog="sheet" style={{ position: "fixed", bottom: 86, right: offsetRight, width: "min(360px, calc(100vw - 24px))", maxHeight: "72vh", overflowY: "auto", background: B1, border: `1px solid ${BD2}`, borderRadius: 16, padding: "14px", zIndex: 89, boxShadow: "0 18px 60px rgba(0,0,0,0.6)", animation: "fadeIn 0.18s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T1, letterSpacing: 0.5 }}>⚡ Quick Log · {done.length}/{scheduled.length} today</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={14} /></button>
          </div>

          {/* Habits */}
          {remaining.length === 0 ? (
            <div style={{ padding: "12px 10px 4px", textAlign: "center", fontSize: 12.5, color: GR }}>⭐ Every habit done. Perfect day.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 11 }}>
              {remaining.map((h) => {
                const v = valueOn(h, ds), target = h.target || 1;
                return (
                  <button key={h.id} onClick={() => onTap(h.id)} style={row}>
                    <span style={{ fontSize: 15 }}>{h.icon}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: T1 }}>{h.name}</span>
                    {target > 1
                      ? <span style={{ fontSize: 10.5, color: h.color, fontFamily: "monospace" }}>{v}/{target}{h.unit ? ` ${h.unit}` : ""} +1</span>
                      : <Check size={13} color={h.color} />}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── MEALS · select meal type, then add ── */}
          <SectionHead icon={<Utensils size={11} color={GR} />}>Meals</SectionHead>
          <select value={mealSlot} onChange={(e) => setMealSlot(e.target.value)} aria-label="Meal type" style={selStyle}>
            <option value="">Select meal type…</option>
            {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.l}</option>)}
          </select>

          {!mealSlot ? (
            <div style={{ fontSize: 11.5, color: T3, margin: "8px 2px 0", lineHeight: 1.5 }}>Pick a meal type to add food under it.</div>
          ) : (
            <div style={{ marginTop: 9 }}>
              {/* today's entries in this slot — the log grouped by meal type */}
              {todaySlotEntries.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 9, padding: "8px 10px", background: `${GR}0a`, border: `1px solid ${GR}22`, borderRadius: 9 }}>
                  <span style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{slotLabel} today · {todaySlotEntries.length}</span>
                  {todaySlotEntries.map((e) => (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T1 }}>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                      <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace" }}>{e.grams}g</span>
                      <button onClick={() => removeSlotEntry(e.id)} aria-label={`Remove ${e.name}`} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* your regulars for this slot — one tap logs the usual portion */}
              {regulars.length > 0 && !foodQ.trim() && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>Your {slotLabel.toLowerCase()} regulars</span>
                  {regulars.map((r2) => (
                    <button key={`${r2.name}|${r2.grams}`} onClick={() => addRegular(r2)} aria-label={`Log ${r2.name}`} style={row}>
                      <span style={{ fontSize: 14 }}>🍽️</span>
                      <span style={{ flex: 1, fontSize: 12.5, color: T1 }}>{r2.name}</span>
                      <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace" }}>{r2.grams}g · +</span>
                    </button>
                  ))}
                </div>
              )}

              {/* full library — searchable, relevant items ordered first */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", background: B2, border: `1px solid ${BD}`, borderRadius: 9, marginBottom: 6 }}>
                <Search size={13} color={T3} />
                <input value={foodQ} onChange={(e) => setFoodQ(e.target.value)} placeholder="Search all foods…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T1, fontSize: 12.5, fontFamily: "inherit" }} />
                {foodQ && <button onClick={() => setFoodQ("")} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={12} /></button>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {foodMatches.map((f) => (
                  <button key={f.id} onClick={() => addFood(f)} aria-label={`Add ${f.name}`} style={{ ...row, padding: "8px 11px" }}>
                    <span style={{ fontSize: 13 }}>🍽️</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    {Array.isArray(f.tags) && f.tags.includes("QUICK-ADD") && <span style={{ fontSize: 8.5, color: AM, border: `1px solid ${AM}55`, borderRadius: 5, padding: "1px 4px", letterSpacing: 0.5 }}>QUICK</span>}
                    <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace" }}>{f.serving?.g || 100}g</span>
                  </button>
                ))}
                {foodMatches.length === 0 && <div style={{ fontSize: 11.5, color: T3, padding: "6px 2px" }}>No foods match “{foodQ.trim()}”.</div>}
              </div>

              {yesterdayMeals.length > 0 && (
                <button onClick={copyYesterday} style={{ ...row, justifyContent: "center", gap: 6, marginTop: 8, color: CY, border: `1px solid ${CY}44` }}>
                  <Copy size={12} /><span style={{ fontSize: 12, fontWeight: 600 }}>Copy yesterday's full log</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} title="Quick log" aria-label="Quick log"
        style={{ position: "fixed", bottom: 22, right: offsetRight, width: size, height: size, borderRadius: "50%", background: B1, border: `1px solid ${BD2}`, cursor: "pointer", zIndex: 89, boxShadow: "0 8px 28px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BD} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct === 100 ? GR : CY} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`} style={{ transition: "stroke-dasharray 0.4s ease" }} />
        </svg>
        {pct === 100 ? <Check size={20} color={GR} /> : <Zap size={18} color={CY} />}
      </button>
    </>
  );
}
