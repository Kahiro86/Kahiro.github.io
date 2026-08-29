// Phase 5 — the day's habits and meals log from anywhere, against the real
// habit store. QuickLog was built, then orphaned: 214 lines nothing imported,
// still reading the legacy store the tracker replaced.
import { harness, tally, ago, TODAY } from "../fixtures/harness.mjs";

const H = (id, name) => ({ id, name, subtype: "standard", type: "boolean", frequencyType: "daily",
  frequencyDays: null, frequencyCount: null, target: null, targetDirection: "at_least", unit: null,
  routineId: null, archivedAt: null, createdAt: `${ago(30)}T12:00:00.000Z`, updatedAt: `${ago(30)}T12:00:00.000Z`, sortOrder: 0 });

const seed = {
  ht_habits: [H("h1", "Deep work 90m"), H("h2", "Read 20 pages")],
  ht_entries: [],
  // A returning user: no onboarding overlay, no What's New. This test is about
  // the quick log, not about first-run chrome.
  onboarding: { overviewSeen: true, done: true },
  whatsnew_seen: "3.1",
};

const t = tally("Quick log");
const ok = t.ok;
const h = await harness({ seed, viewport: { width: 1280, height: 1000 } });
const { page } = h;

console.log("\n── it exists, and it sees the real habits ──");
const fab = page.getByRole("button", { name: "Quick log", exact: true });
ok("the quick-log control is on screen", await fab.count() > 0);

await fab.first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(600);
const panel = page.locator('[data-quicklog="sheet"]');
ok("the sheet opened", await panel.count() > 0);
const sheet = await panel.innerText();
ok("it lists the tracker's habits, not the retired store", /Deep work 90m/.test(sheet) && /Read 20 pages/.test(sheet));

console.log("\n── a tap writes to the tracker ──");
const before = await page.evaluate(() => JSON.parse(localStorage.getItem("architect:ht_entries") || "[]").length);
// Scoped to the sheet — the same habit name also appears behind it.
await panel.getByText("Deep work 90m").first().click({ timeout: 6000 }).catch((e) => console.log("     click:", String(e).split("\n")[0]));
await page.waitForTimeout(900);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem("architect:ht_entries") || "[]"));
console.log(`     ht_entries ${before} → ${after.length}`);
ok("the tap landed in ht_entries", after.length === before + 1);
ok("on the right habit and today's date", after.some((e) => e.habitId === "h1" && String(e.date).slice(0, 10) === TODAY));
ok("as a completion", after.some((e) => e.habitId === "h1" && Number(e.value) > 0));

console.log("\n── it is reachable from every facet, not just Home ──");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
ok("Escape closes the sheet", await page.locator('[data-quicklog="sheet"]').count() === 0);
for (const facet of ["gym", "analytics"]) {
  await h.go(facet, 900);
  ok(`still mounted on ${facet}`, await page.getByRole("button", { name: "Quick log", exact: true }).count() > 0);
}

await h.close();
t.done(h.errors, { failOnError: true });
