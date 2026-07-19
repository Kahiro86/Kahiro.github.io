import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// Portable: the built single-file app sits at ../dist/index.html relative to
// this test. Launch Playwright's resolved Chromium; PLAYWRIGHT_CHROMIUM_PATH
// overrides it (used by the dev sandbox where the browser lives elsewhere).
const BASE = new URL("../dist/index.html", import.meta.url).href;
const distPath = fileURLToPath(BASE);
if (!existsSync(distPath)) {
  console.error(`Build not found at ${distPath} — run "npm run build" first.`);
  process.exit(1);
}
const EXE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
// [module id, sidebar label] pairs — we navigate by clicking the sidebar button.
const MODULES = [
  ["dashboard", "Command Center"], ["firm", "The Firm"], ["trading", "Trading OS"], ["athlete", "Athlete OS"],
  ["finance", "Finance OS"], ["life", "Life OS"], ["mind", "Mind OS"], ["faith", "Faith OS"],
  ["journey", "Journey"], ["analytics", "Analytics"],
];

// Data scenarios: each seeds localStorage BEFORE the app boots.
const SCENARIOS = {
  fresh: {},
  corruptHabits: { "architect:habits": JSON.stringify([null, { junk: true }, "x", 5, { name: "Real", history: ["2026-07-01"] }]) },
  habitsNotArray: { "architect:habits": JSON.stringify({ nope: 1 }) },
  corruptTrades: { "architect:ict_trades": JSON.stringify({ notAnArray: true }) },
  tradesBadJSON: { "architect:ict_trades": "{not valid json" },
  corruptFinance: { "architect:finance_state": JSON.stringify(null) },
  corruptRoutines: { "architect:life_routines": JSON.stringify([{ id: "r1", name: "Morning", habitIds: null }]) },
  corruptJournal: { "architect:journal_entries": JSON.stringify("string-not-array") },
  everythingNull: {
    "architect:habits": "null",
    "architect:ict_trades": "null",
    "architect:finance_state": "null",
    "architect:athlete_workouts": "null",
  },
  nullEntriesEverywhere: {
    "architect:ict_trades": JSON.stringify([null, { id: "t1", status: "CLOSED", outcome: "WIN" }, null]),
    "architect:athlete_workouts": JSON.stringify([null, { id: "w1", type: "strength", name: "Push", date: "2026-07-01", exercises: [null, { name: "Bench", sets: [] }] }]),
    "architect:routines": JSON.stringify([null, { id: "r1", name: "AM", icon: "🌅" }]),
    "architect:journal_entries": JSON.stringify([null, { id: "j1", date: "2026-07-01", text: "hi" }]),
    "architect:habits": JSON.stringify([{ id: "h1", name: "Pray", log: { "2026-07-01": null, "2026-07-02": { v: 1 } } }]),
  },
  partialFinance: {
    "architect:finance_state": JSON.stringify({ currency: "KES", mmfs: null, budgets: [null], goals: null, income: [null], debts: null }),
  },
  corruptWave3: {
    "architect:faith_scripture": JSON.stringify([null, { id: "v1", ref: "John 3:16" }, "junk"]),
    "architect:faith_church": JSON.stringify([null, 123, "2026-07-06"]),
    "architect:faith_notes": "null",
    "architect:mind_library": JSON.stringify([null, { id: "b1", title: "T", pagesTotal: "x", pagesRead: null }]),
    "architect:mind_decisions": JSON.stringify([{ id: "d1", date: null }]),
    "architect:life_projects": JSON.stringify([null, { junk: 1 }, { id: "p1", name: "P", status: "weird" }]),
    "architect:missions": JSON.stringify([null, { id: "m1", level: "bogus", title: "x" }, { id: "m2", level: "day", title: "ok" }]),
  },
  corruptWave4: {
    "architect:ict_reviews": JSON.stringify([null, { id: "r1" }, { id: "r2", kind: "weird", period: 5 }, "x"]),
    "architect:finance_state": JSON.stringify({ currency: "KES", bills: [null, { id: "b1", name: "Rent", amount: "x", dueDay: 99 }, "junk"] }),
    "architect:ict_trades": JSON.stringify([{ id: "t1", status: "CLOSED", date: null, checklistTotal: "x" }]),
  },
  corruptWave5: {
    "architect:athlete_measurements": JSON.stringify([null, { id: "m1", weight: "x", date: null }, "junk"]),
    "architect:athlete_workouts": JSON.stringify([{ id: "w1", type: "cardio", date: "2026-07-01", duration: "x", distance: null }, { id: "w2", type: "mobility", date: "2026-07-02" }]),
  },
  corruptChecklists: {
    "architect:ict_checklist_templates": "null",
    "architect:ict_active_checklist": JSON.stringify(123),
    "architect:ict_balance": JSON.stringify("not a number"),
  },
  corruptPurity: {
    "architect:purity_log": JSON.stringify({
      "2026-07-01": null,
      "bad-key": { s: "pure" },
      "2026-07-02": { s: "weird" },
      "2026-07-03": { s: "relapse", triggers: [null, 5, "Stress"] },
      "2026-07-04": "junk",
      "2026-07-05": { s: "pure", triggers: "not-an-array", helped: 42 },
    }),
  },
  corruptPurityShape: {
    "architect:purity_log": JSON.stringify([1, 2, 3]),
  },
  corruptXp: {
    "architect:xp_achievements": JSON.stringify({ first_rep: 12345, bogus_id: "2026-07-01", first_trade: null, habits_100: "not-a-date" }),
    "architect:xp_logins": JSON.stringify([1, 2, 3]),
    "architect:mind_library": JSON.stringify([{ id: "b1", finishedAt: 99 }]),
    "architect:faith_scripture": JSON.stringify([null, { id: "v1", reviews: "x", addedAt: null, lastReviewed: 7 }]),
  },
  corruptXpShape: {
    "architect:xp_achievements": "\"just a string\"",
    "architect:xp_logins": "null",
  },
  corruptNutrition: {
    "architect:nutrition_log": JSON.stringify({
      "2026-07-01": [null, { id: "a", name: "x", grams: "bad", n: null, slot: "weird" }, "junk", { id: "b", name: "ok", grams: 100, n: { kcal: "x", p: 5 } }],
      "bad-date": [{ id: "c", name: "y", n: {} }],
      "2026-07-02": "not-an-array",
    }),
    "architect:nutrition_foods": JSON.stringify([null, { id: 5 }, { id: "f1", name: "Custom", per100: [1, 2] }, { id: "f2", name: "Good", per100: { kcal: 100 } }]),
    "architect:nutrition_profile": JSON.stringify({ age: "old", sex: "yes", weightKg: -5, activity: 99, goal: "become batman", overrides: [1] }),
  },
  corruptNutritionShape: {
    "architect:nutrition_log": "[]",
    "architect:nutrition_profile": "\"nope\"",
  },

  corruptLock: {
    "kahiro_lock": '{"hash": 12, "salt": null, "len": "x"}',
  },
  corruptNotif: {
    "architect:notif_reminders": JSON.stringify([null, "junk", { id: 5 }, { id: "r1", title: "ok", date: "bad", time: 99, repeat: { kind: "sometimes", n: -3 }, priority: "extreme", icon: 7 }]),
    "architect:notif_log": JSON.stringify([null, { id: "a" }, { id: "b", title: "x", state: "vanished", firedAt: "soon", esc: 99, snoozeUntil: [] }, "str"]),
    "architect:notif_prefs": JSON.stringify([1, 2]),
  },
  corruptNotifShape: {
    "architect:notif_reminders": "{}",
    "architect:notif_log": '"nope"',
    "architect:notif_prefs": "12",
  },
  corruptGoals: {
    "architect:goals": JSON.stringify([
      null, "junk", { id: 5 },
      { id: "g1", name: "", target: 10 },
      { id: "g2", name: "Bad numbers", area: "bogus", target: "x", current: -4, deadline: 99, ms: [1, 2], completedAt: "nope" },
      { id: "g3", name: "Ok goal", area: "fitness", target: 10, current: 3, ms: { 25: "2026-07-01", 99: "2026-07-02", 50: "bad" } },
      { id: "g4", name: "Bad source", area: "reading", target: 5, current: 1, source: "notARealStat", sourceBase: "x" },
      { id: "g5", name: "Good auto", area: "reading", target: 5, current: 2, source: "booksFinished", sourceBase: 3 },
    ]),
  },
  corruptGoalsShape: {
    "architect:goals": JSON.stringify({ not: "an array" }),
  },
  corruptFocus: {
    "architect:weekly_focus": JSON.stringify({ "2026-W29": "Fitness", "bad-key": "x", "2026-W30": 123, "2026-W31": "   " }),
  },
  corruptFocusShape: {
    "architect:weekly_focus": JSON.stringify([1, 2, 3]),
  },
  corruptFirm: {
    "architect:firm_withdrawals": JSON.stringify([
      null, "junk", { id: 5 },
      { id: "w1", date: "2026-06-01", amount: "x", split: null },
      { id: "w2", date: 99, amount: 500, split: { fleet: "a", vault: 1, book: 1, life: 1 } },
      { id: "w3", date: "2026-06-20", amount: 500, split: { fleet: 200, vault: 150, book: 100, life: 50 } },
    ]),
    "architect:firm_config": JSON.stringify({
      riskPerTradePct: "nope", aggregateExposureCap: null,
      fleetFormula: { fleet: "x", vault: -5 }, vaultTargetKsh: "lots",
      accounts: [null, { id: "bad" }, "junk", { firm: 123, size: -9 }],
    }),
    "architect:firm_covenant": JSON.stringify({ signedAt: 12345 }),
    "architect:firm_campaign": JSON.stringify({ currentQuarter: "Z9Q9" }),
  },
  corruptFirmShape: {
    "architect:firm_withdrawals": JSON.stringify({ not: "an array" }),
    "architect:firm_config": JSON.stringify([1, 2, 3]),
    "architect:firm_covenant": JSON.stringify("nope"),
    "architect:firm_campaign": JSON.stringify([1, 2, 3]),
  },
};

const viewports = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 } };

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
let failures = 0;

for (const [vpName, viewport] of Object.entries(viewports)) {
  for (const [scName, seed] of Object.entries(SCENARIOS)) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

    // Seed storage on the origin before the SPA script runs.
    await page.addInitScript((seed) => {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }, seed);

    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(400);
    // Dismiss any auto-opened overlay (e.g. the Sunday Week-in-Review) so it
    // can't intercept the navigation clicks below.
    try { await page.keyboard.press("Escape"); await page.waitForTimeout(60); } catch {}
    const isMobile = vpName === "mobile";

    for (const [mod, label] of MODULES) {
      // On mobile the sidebar is a drawer — open it via the header menu button first.
      if (isMobile) {
        try { await page.locator('[aria-label="Open menu"]').first().click({ timeout: 1000 }); } catch {}
        await page.waitForTimeout(80);
      }
      try {
        await page.locator(`button:has-text("${label}")`).first().click({ timeout: 1500 });
      } catch { /* leave module as-is; the len check still reports blank */ }
      await page.waitForTimeout(180);

      const check = async (where) => {
        const info = await page.evaluate(() => {
          const root = document.getElementById("root");
          const txt = (root?.innerText || "").trim();
          return { len: txt.length, snag: txt.includes("hit a snag"), sample: txt.slice(0, 60) };
        });
        const blank = info.len < 5;
        if (blank) failures++;
        if (blank || info.snag) {
          console.log(`[${vpName}/${scName}] ${where.padEnd(18)} ${blank ? "BLANK❌" : "SNAG⚠️"}  len=${info.len}  "${info.sample.replace(/\n/g, " ")}"`);
        }
      };
      await check(mod);

      // Exercise the sub-tabs where most rendering lives.
      const SUBTABS = {
        athlete: ["History", "Progress", "Body", "Nutrition", "This Week"],
        trading: ["Analytics", "Risk Calc", "Playbook", "Reports", "Reviews", "Trade Log"],
        life: ["Habits", "Routines", "Insights", "Journal", "Projects", "Purity", "Today"],
        mind: ["Notes", "Decisions", "Library"],
        faith: ["Scripture", "Devotional", "The Walk"],
        finance: ["Budget", "Reports", "Net Worth"],
        analytics: ["Trends", "Progression", "Reports"],
        journey: ["Hall of Fame", "Goals"],
        firm: ["Vault", "Gate", "Campaign", "Contingency", "Covenant", "Fleet"],
      }[mod] || [];
      for (const st of SUBTABS) {
        try { await page.locator(`button:has-text("${st}")`).first().click({ timeout: 900 }); } catch { continue; }
        await page.waitForTimeout(120);
        await check(`${mod}/${st}`);
      }
    }
    if (errors.length) {
      console.log(`   errors[${vpName}/${scName}]: ${[...new Set(errors)].slice(0, 3).join(" | ")}`);
    }
    await ctx.close();
  }
}

console.log(failures === 0 ? "\nALL PASS — no blank pages" : `\n${failures} BLANK cases`);
await browser.close();
process.exit(failures === 0 ? 0 : 1);
