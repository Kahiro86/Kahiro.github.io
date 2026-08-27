// ── Nutrition, as its own facet ──────────────────────────────────────
// Fuel used to live two levels inside Body → Fuel, which put the thing
// decided most often in a day behind the thing decided three times a week.
// It now sits directly after Home (§13), in the same shell language as Body:
// a ModuleTabs strip, one screen per question, no second dashboard.
//
// Progressive disclosure is the whole layout rule (§2). Today answers "what
// have I eaten and what is left" and nothing else; Plan, Micros and Trends
// are there when they are asked for. Nothing that belongs to one is repeated
// in another.
import { useState, useMemo, useEffect } from "react";
import { Utensils, ClipboardList, FlaskConical, TrendingUp } from "lucide-react";
import { AC2, T1, T2, T3, GR, AM, RE, BD } from "../../shared/designTokens.js";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { localDateStr } from "../../shared/dates.js";
import { NutritionTab } from "./NutritionTab.jsx";
import {
  sanitizeNutrition, sanitizeProfile, calcTargets, dayEntries, dayTotals,
  DEFAULT_PROFILE, MICROS, NUTRIENTS, coverage,
} from "./nutrition.js";
import { dayTargets } from "./bodyTargets.js";

const TABS = [
  { id: "today", l: "Today", i: Utensils },
  { id: "plan", l: "Plan", i: ClipboardList },
  { id: "micros", l: "Micros", i: FlaskConical },
  { id: "trends", l: "Trends", i: TrendingUp },
];

export function NutritionOS({ navHint }) {
  const [tab, setTab] = useState("today");
  useEffect(() => { if (navHint?.group && TABS.some((t) => t.id === navHint.group)) setTab(navHint.group); }, [navHint]);

  const [rawLog] = useStorageState("nutrition_log", {});
  const [rawProfile] = useStorageState("nutrition_profile", DEFAULT_PROFILE);
  const [gymSessions] = useStorageState("gym_sessions", []);
  const ds = localDateStr();

  const log = useMemo(() => sanitizeNutrition(rawLog), [rawLog]);
  const profile = useMemo(() => sanitizeProfile(rawProfile), [rawProfile]);
  const body = useMemo(() => dayTargets({ profile, sessions: gymSessions, ds, today: ds }), [profile, gymSessions, ds]);
  const targets = body.targets;
  const totals = useMemo(() => dayTotals(dayEntries(log, ds)), [log, ds]);

  // The one line the facet header carries: what is left, not what was eaten.
  // "Remaining" is the number a person acts on; "consumed" is the number they
  // already know.
  const left = Math.max(0, Math.round((targets.kcal || 0) - (totals.kcal || 0)));
  const over = (totals.kcal || 0) > (targets.kcal || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tabs={TABS} active={tab} onSelect={setTab}
        activeBg={`linear-gradient(135deg,${AC2}22,${AC2}14)`} activeColor={AC2}>
        <div style={{ flex: 1 }} />
        <div title={`${body.trained ? "Training" : "Rest"} day target — ${targets.kcal} kcal`}
          style={{ display: "flex", alignItems: "baseline", gap: 7, padding: "5px 12px", background: `${AC2}11`, border: `1px solid ${AC2}22`, borderRadius: 9 }}>
          <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: over ? AM : T1 }}>
            {over ? `+${Math.round((totals.kcal || 0) - (targets.kcal || 0))}` : left}
          </span>
          <span style={{ fontSize: 10, color: T3 }}>{over ? "kcal over" : "kcal left"}</span>
        </div>
      </ModuleTabs>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Today is the existing logger, which already owns the day's macros,
            meals, water and score. It is not re-implemented here — the facet
            is a home for it, not a replacement. */}
        {tab === "today" && <NutritionTab only={["today"]} />}
        {tab === "plan" && <NutritionTab only={["plan"]} />}
        {tab === "micros" && <MicroScreen totals={totals} targets={targets} logged={dayEntries(log, ds).length > 0} />}
        {tab === "trends" && <NutritionTab only={["trends"]} />}
      </div>
    </div>
  );
}

// ── Micros ───────────────────────────────────────────────────────────
// Coverage against the reference intake, worst first. Ordering by shortfall
// rather than alphabetically is the difference between a table and an answer:
// the first row is the thing to eat something about.
function MicroScreen({ totals, targets, logged }) {
  const rows = useMemo(() => MICROS
    .map((k) => {
      const def = NUTRIENTS.find((n) => n.k === k);
      return { k, label: def?.l || k, unit: def?.u || "", rda: def?.rda || 0, have: +totals[k] || 0, cov: coverage(totals, k) };
    })
    .filter((r) => r.rda > 0)
    .sort((a, b) => (a.cov ?? 0) - (b.cov ?? 0)), [totals]);

  if (!logged) {
    return (
      <div style={{ padding: "40px 24px", textAlign: "center", color: T3, fontSize: 12.5 }}>
        Nothing logged today yet — micronutrients follow the food.
      </div>
    );
  }

  const short = rows.filter((r) => (r.cov ?? 0) < 60);

  return (
    <div style={{ padding: "18px 24px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      {short.length > 0 && (
        <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.55 }}>
          Lowest today: {short.slice(0, 3).map((r) => r.label).join(", ")}.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.map((r) => {
          const c = r.cov ?? 0;
          const tone = c >= 80 ? GR : c >= 50 ? AM : RE;
          return (
            <div key={r.k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11.5, color: T2, width: 108, flexShrink: 0 }}>{r.label}</span>
              <span style={{ flex: 1, height: 5, background: BD, borderRadius: 3, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${Math.min(100, c)}%`, background: tone, borderRadius: 3 }} />
              </span>
              <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace", width: 96, textAlign: "right", flexShrink: 0 }}>
                {Math.round(r.have)}{r.unit} / {r.rda}{r.unit}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: T3, lineHeight: 1.5 }}>
        Against the reference daily intake, from the foods logged today. Protein, carbohydrate and fat are on Today; these are what the food carried besides them.
      </div>
    </div>
  );
}
