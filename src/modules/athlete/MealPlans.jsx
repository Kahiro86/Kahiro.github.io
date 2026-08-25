// ── Meal plans, on the Fuel screen ───────────────────────────────────
// A plan is written once and applied to whichever day you are logging. It
// is never intake by itself: "Log this" writes ordinary entries into
// nutrition_log, and until you press it the plan has said nothing about
// what you ate.
import { useMemo, useState } from "react";
import { Plus, Trash2, Upload, Check, ChevronRight, Repeat } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, GR, RE, AM, AC2, CY } from "../../shared/designTokens.js";
import { Card, SH, Empty } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { SLOTS } from "./nutrition.js";
import {
  sanitizePlans, sanitizePlan, parsePlanCsv, planTotals, planVsTarget,
  planToEntries, itemsFor, chosenOption, bandsFromTargets, DAY_TYPES,
  adherenceSeries,
} from "./mealPlans.js";

const input = { background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", width: "100%" };
const btn = (extra = {}) => ({ padding: "7px 12px", borderRadius: 9, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", background: GL, border: `1px solid ${BD}`, color: T2, display: "flex", alignItems: "center", gap: 6, ...extra });
const slotLabel = (id) => SLOTS.find((s) => s.id === id)?.l || id;
const STATE_COLOR = { under: AM, over: AM, in: GR };

// One macro against its band. The band is shown, not just the verdict —
// "194 of 180-190" is a number you can act on; "over" on its own is a mood.
function BandRow({ k, label, unit, v }) {
  if (!v) return null;
  const c = STATE_COLOR[v.state] || T2;
  return (
    <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 11.5 }}>
      <span style={{ color: T3, minWidth: 60 }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontWeight: 700, color: c }}>{v.value}{unit}</span>
      <span style={{ color: T3, fontSize: 10.5 }}>of {v.band[0]}–{v.band[1]}{unit}</span>
      {v.gap > 0 && <span style={{ color: c, fontSize: 10.5 }}>· {v.state} by {v.gap}{unit}</span>}
    </div>
  );
}

export function MealPlans({ foods, targets, dayType, logDs, log, onApply }) {
  const [rawPlans, setPlans] = useStorageState("nutrition_plans", []);
  const [openId, setOpenId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [csv, setCsv] = useState("");
  const [csvName, setCsvName] = useState("");
  const [err, setErr] = useState("");
  const toast = useToast();

  const plans = useMemo(() => sanitizePlans(rawPlans), [rawPlans]);
  const open = plans.find((p) => p.id === openId) || null;

  // The plan's own band when it states one, otherwise the day's computed
  // targets ±5%. A plan written with "2500-2800" means that, and replacing
  // it with a single computed figure would overrule the person who wrote it.
  const bands = open?.targets && Object.keys(open.targets).length ? open.targets : bandsFromTargets(targets);
  const totals = useMemo(() => (open ? planTotals(open, foods, dayType) : null), [open, foods, dayType]);
  const verdict = useMemo(() => (totals ? planVsTarget(totals.day, bands) : null), [totals, bands]);
  // How the last 30 days actually went against this plan. A plan you never
  // check yourself against is a document, not a system.
  const adherence = useMemo(
    () => (open ? adherenceSeries({ plan: open, log, days: 30, today: logDs, dayTypeFor: () => dayType, bands }) : null),
    [open, log, logDs, dayType, bands],
  );

  const save = (next) => setPlans(next.map((p) => sanitizePlan(p)));

  const doImport = () => {
    const { plan, errors } = parsePlanCsv(csv, { name: csvName.trim() || "Imported plan" });
    if (!plan) { setErr(errors.join(" ") || "Could not read that."); return; }
    save([plan, ...plans]);
    setImporting(false); setCsv(""); setCsvName(""); setErr("");
    setOpenId(plan.id);
    toast(`Imported "${plan.name}" — ${plan.meals.length} meals`, { tone: "success" });
  };

  const readFile = async (file) => {
    if (!file) return;
    try {
      setCsv(await file.text());
      if (!csvName) setCsvName(file.name.replace(/\.csv$/i, "").replace(/[_-]+/g, " "));
      setErr("");
    } catch { setErr("Could not read that file."); }
  };

  const chooseOption = (planId, mealId, itemId, idx) => {
    save(plans.map((p) => (p.id !== planId ? p : {
      ...p,
      meals: p.meals.map((m) => (m.id !== mealId ? m : {
        ...m,
        items: m.items.map((i) => (i.id === itemId ? { ...i, chosen: idx } : i)),
      })),
    })));
  };

  const apply = (plan, mealIds = null) => {
    const entries = planToEntries(plan, foods, { dayType, mealIds });
    if (!entries.length) { toast("Nothing to log from that.", { tone: "info" }); return; }
    onApply(entries);
    toast(`${entries.length} item${entries.length === 1 ? "" : "s"} logged to ${logDs}`, { tone: "success" });
  };

  const remove = (id) => {
    save(plans.filter((p) => p.id !== id));
    if (openId === id) setOpenId(null);
  };

  return (
    <Card>
      <SH title="Meal plans" sub="A day's eating, written once and applied to any day"
        action={
          <button onClick={() => { setImporting((v) => !v); setErr(""); }} style={btn({ color: AC2, border: `1px solid ${AC2}44` })}>
            <Upload size={12} /> Import CSV
          </button>
        } />

      {importing && (
        <div style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 11, padding: 13, marginBottom: 12, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.55 }}>
            Paste a plan, or pick a .csv. Columns: <span style={{ fontFamily: "monospace", color: T1 }}>Meal, Food, Amount, Protein (g), Carbs (g), Fat (g), Calories</span>.
            A food written as <span style={{ color: T1 }}>“chicken / beef / salmon”</span> becomes one item you can swap between;
            subtotal and total rows are skipped, and a <span style={{ color: T1 }}>Target Range</span> row becomes the plan's band.
          </div>
          <input value={csvName} onChange={(e) => setCsvName(e.target.value)} placeholder="Plan name" style={input} />
          <input type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])}
            aria-label="Choose a CSV file" style={{ fontSize: 11.5, color: T3 }} />
          <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setErr(""); }} rows={5}
            placeholder="…or paste the CSV here" aria-label="Paste CSV" style={{ ...input, fontFamily: "monospace", fontSize: 11 }} />
          {err && <div style={{ fontSize: 11.5, color: RE }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={doImport} disabled={!csv.trim()}
              style={btn({ background: csv.trim() ? `${GR}18` : GL, border: `1px solid ${csv.trim() ? GR + "55" : BD}`, color: csv.trim() ? GR : T3, cursor: csv.trim() ? "pointer" : "not-allowed" })}>
              <Check size={12} /> Import
            </button>
            <button onClick={() => { setImporting(false); setCsv(""); setErr(""); }} style={btn()}>Cancel</button>
          </div>
        </div>
      )}

      {!plans.length && !importing && (
        <Empty icon="🍱" title="No plans yet"
          sub="Import the spreadsheet you already keep, and any day becomes one tap to log." />
      )}

      {plans.map((p) => {
        const isOpen = p.id === openId;
        return (
          <div key={p.id} style={{ border: `1px solid ${isOpen ? AC2 + "44" : BD}`, borderRadius: 11, marginBottom: 9, overflow: "hidden" }}>
            <button onClick={() => setOpenId(isOpen ? null : p.id)} aria-expanded={isOpen}
              style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", background: isOpen ? `${AC2}0A` : "none", border: "none", padding: "11px 13px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <ChevronRight size={13} color={T3} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T1, flex: 1, minWidth: 0 }}>{p.name}</span>
              <span style={{ fontSize: 10.5, color: T3 }}>{p.meals.length} meals</span>
            </button>

            {isOpen && totals && (
              <div style={{ padding: "0 13px 13px" }}>
                {/* Day type — a rest day genuinely is a different plan. */}
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11, flexWrap: "wrap" }}>
                  <Repeat size={11} color={T3} />
                  <span style={{ fontSize: 10.5, color: T3 }}>
                    Showing the <span style={{ color: T1 }}>{DAY_TYPES.find((d) => d.id === dayType)?.l.toLowerCase() || dayType}</span> version — this follows the day you are logging.
                  </span>
                </div>

                {totals.meals.map((mt) => {
                  const meal = p.meals.find((m) => m.id === mt.id);
                  const shown = itemsFor(meal, dayType);
                  return (
                    <div key={mt.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: T1 }}>{meal.name}</span>
                        <span style={{ fontSize: 10, color: T3 }}>{slotLabel(meal.slot)}</span>
                        <span style={{ marginLeft: "auto", fontSize: 10.5, fontFamily: "monospace", color: T2 }}>
                          {Math.round(mt.totals.kcal)} kcal · {Math.round(mt.totals.p)}P {Math.round(mt.totals.c)}C {Math.round(mt.totals.f)}F
                        </span>
                        <button onClick={() => apply(p, [meal.id])} style={btn({ padding: "4px 9px", fontSize: 10.5 })}>Log this meal</button>
                      </div>
                      {shown.map((item) => {
                        const pick = chosenOption(item);
                        return (
                          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12, color: T2, minWidth: 0 }}>{pick.name}</span>
                            <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace" }}>{pick.portion || `${Math.round(pick.grams)}g`}</span>
                            {item.dayType !== "any" && (
                              <span style={{ fontSize: 9, color: CY, border: `1px solid ${CY}44`, borderRadius: 6, padding: "1px 6px" }}>
                                {item.dayType} only
                              </span>
                            )}
                            {item.options.length > 1 && (
                              <span style={{ display: "flex", gap: 4, marginLeft: "auto", flexWrap: "wrap" }}>
                                {item.options.map((o, idx) => (
                                  <button key={o.name} onClick={() => chooseOption(p.id, meal.id, item.id, idx)}
                                    aria-label={`Use ${o.name}`} aria-pressed={idx === item.chosen}
                                    style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                                      border: `1px solid ${idx === item.chosen ? AC2 + "66" : BD}`,
                                      background: idx === item.chosen ? `${AC2}18` : "none",
                                      color: idx === item.chosen ? AC2 : T3 }}>
                                    {o.name}
                                  </button>
                                ))}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* The day, against the band */}
                <div style={{ borderTop: `1px solid ${BD}`, paddingTop: 11, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: T3, fontWeight: 700, marginBottom: 3 }}>
                    The day as planned
                  </div>
                  <BandRow k="kcal" label="Calories" unit="" v={verdict.kcal} />
                  <BandRow k="p" label="Protein" unit="g" v={verdict.p} />
                  <BandRow k="c" label="Carbs" unit="g" v={verdict.c} />
                  <BandRow k="f" label="Fat" unit="g" v={verdict.f} />
                  {!Object.keys(verdict).length && (
                    <div style={{ fontSize: 11.5, color: T3 }}>
                      {Math.round(totals.day.kcal)} kcal · {Math.round(totals.day.p)}P {Math.round(totals.day.c)}C {Math.round(totals.day.f)}F
                    </div>
                  )}
                </div>

                {/* Adherence — the answer to "did I actually follow this?" */}
                {adherence && adherence.loggedDays > 0 && (
                  <div style={{ borderTop: `1px solid ${BD}`, paddingTop: 11, marginTop: 11 }}>
                    <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: T3, fontWeight: 700, marginBottom: 5 }}>
                      Last 30 days
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: 11.5 }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 17, color: adherence.coverage >= 80 ? GR : adherence.coverage >= 50 ? AM : T2 }}>
                        {adherence.coverage}%
                      </span>
                      <span style={{ color: T3 }}>
                        of the plan, over {adherence.loggedDays} logged day{adherence.loggedDays === 1 ? "" : "s"}
                      </span>
                      {adherence.unloggedDays > 0 && (
                        <span style={{ color: T3, fontSize: 10.5 }}>
                          · {adherence.unloggedDays} day{adherence.unloggedDays === 1 ? "" : "s"} not recorded, not counted
                        </span>
                      )}
                    </div>
                    {adherence.chronicMisses.length > 0 && (
                      <div style={{ fontSize: 11, color: T3, marginTop: 7, lineHeight: 1.55 }}>
                        Most often missed:{" "}
                        {adherence.chronicMisses.map((m, i) => (
                          <span key={m.name}>
                            {i > 0 && " · "}
                            <span style={{ color: T2 }}>{m.name}</span> ({m.missedDays}×)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {p.note && (
                  <div style={{ fontSize: 11, color: T3, lineHeight: 1.55, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${BD}` }}>
                    {p.note}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => apply(p)} style={btn({ background: `${GR}18`, border: `1px solid ${GR}55`, color: GR })}>
                    <Plus size={12} /> Log the whole day to {logDs}
                  </button>
                  <button onClick={() => remove(p.id)} aria-label={`Delete ${p.name}`}
                    style={btn({ marginLeft: "auto", color: RE, border: `1px solid ${RE}33` })}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
                <div style={{ fontSize: 10.5, color: T3, marginTop: 8, lineHeight: 1.5 }}>
                  Logging adds to the day — it never replaces what is already there.
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
