// §5 / §14 Test 3: tick Pray, and watch it arrive everywhere without a
// second record being written anywhere. One action, many views.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, join, normalize, resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIST = process.env.QA_DIST || join(root, "dist");
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = createServer((q, r) => { let p = decodeURIComponent((q.url || "/").split("?")[0]); if (p === "/") p = "/index.html"; const fp = normalize(join(DIST, p)); if (!fp.startsWith(DIST) || !existsSync(fp)) { r.statusCode = 404; return r.end("nf"); } r.setHeader("Content-Type", MIME[extname(fp)] || "application/octet-stream"); r.end(readFileSync(fp)); });
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/index.html`;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const TODAY = iso(new Date());

const habit = (over) => ({
  type: "boolean", unit: null, target: null, targetDirection: "at_least",
  frequencyType: "daily", frequencyDays: null, frequencyCount: null,
  icon: "🙏", colour: null, notes: null, archivedAt: null,
  createdAt: `${ago(40)}T06:00:00.000Z`, updatedAt: `${ago(40)}T06:00:00.000Z`, ...over,
});

const seed = {
  onboarding: JSON.stringify({ overviewSeen: true, done: true }),
  whatsnew_seen: JSON.stringify("3.1"),
  ht_habits: JSON.stringify([habit({ id: "hpray", name: "Pray" }), habit({ id: "hscr", name: "Read Scripture" })]),
  ht_entries: JSON.stringify([]),
  faith_scripture: JSON.stringify([{ id: "v1", ref: "Psalm 23", text: "The Lord is my shepherd", addedAt: ago(1), lastReviewed: null, reviews: 0 }]),
};

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const errs = [];
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await b.newPage({ viewport: { width: 1280, height: 1400 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed);
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };
const store = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem(`architect:${key}`) || "null"), k);

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1600); await dismiss(); await page.waitForTimeout(700);

console.log("\n1. Tick Pray in the habit tracker");
await page.locator('[data-tour="nav-habits"]').first().click();
await page.waitForTimeout(1500); await dismiss();
const cell = page.getByRole("button", { name: /Pray, today: not logged yet/i }).first();
ok("the Pray habit is on the habits screen", (await cell.count()) > 0);
await cell.click();
await page.waitForTimeout(900);
const entries = (await store("ht_entries")) || [];
ok("the tick is recorded once", entries.filter((e) => e.habitId === "hpray" && e.date === TODAY).length === 1);

console.log("\n2. It reaches Faith without a second record");
await page.locator('[data-tour="nav-faith"]').first().click();
await page.waitForTimeout(1600); await dismiss();
const faith = (await page.locator("body").innerText()).replace(/\s+/g, " ");
ok("Faith reports days with practice", /days with practice/i.test(faith));
ok("and counts BOTH days of practice — today's prayer and yesterday's scripture",
  /2\/30/.test(faith));
ok("the spiritual list no longer claims there are none", !/no spiritual habits yet/i.test(faith));
ok("it lists the tracked prayer habit", /\bPray\b/.test(faith));
ok("prayer has its own 30-day figure", /prayer . 30d/i.test(faith));
ok("scripture too", /scripture . 30d/i.test(faith));

console.log("\n2b. No duplicate record was written anywhere");
const after = await page.evaluate(() => {
  const out = {};
  for (const k of ["ht_entries", "faith_church", "faith_scripture", "faith_notes", "habits"]) {
    const v = JSON.parse(localStorage.getItem(`architect:${k}`) || "null");
    out[k] = Array.isArray(v) ? v.length : v == null ? 0 : Object.keys(v).length;
  }
  return out;
});
ok("the habit entry is the only new row", after.ht_entries === 1);
ok("nothing was written to faith_church", after.faith_church === 0);
ok("nothing was appended to faith_scripture", after.faith_scripture === 1);
ok("and nothing went into the retired legacy habits store", after.habits === 0);

console.log("\n3. Faith's own 'add a prayer habit' lands in the live tracker");
const seed2 = { ...seed, ht_habits: JSON.stringify([]), ht_entries: JSON.stringify([]) };
const page2 = await b.newPage({ viewport: { width: 1280, height: 1400 } });
page2.on("pageerror", (e) => errs.push(String(e)));
page2.on("console", (m) => { if (m.type() === "error") errs.push("p2: " + m.text()); });
await page2.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed2);
await page2.goto(BASE, { waitUntil: "networkidle" });
for (const n of ["Skip", "Skip the tour"]) { const x = page2.getByRole("button", { name: n, exact: true }); try { if (await x.count()) await x.first().click({ timeout: 1200 }); } catch { } }
await page2.waitForTimeout(1800);
await page2.locator('[data-tour="nav-faith"]').first().click();
await page2.waitForTimeout(1600);
const add = page2.getByRole("button", { name: /add a prayer habit/i }).first();
ok("Faith offers to add one when there are none", (await add.count()) > 0);
await add.click();
await page2.waitForTimeout(1200);
const created = await page2.evaluate(() => ({
  ht: JSON.parse(localStorage.getItem("architect:ht_habits") || "[]"),
  legacy: JSON.parse(localStorage.getItem("architect:habits") || "[]"),
}));
// ht_habits is never empty — the boot migration seeds the purity and journal
// habits — so this asks whether a PRAYER habit now exists, not how many do.
ok("it is created in the live tracker", created.ht.some((h) => /pray/i.test(h.name)));
ok("exactly one of them", created.ht.filter((h) => /pray/i.test(h.name)).length === 1);
ok("and NOT in the retired legacy store", created.legacy.length === 0);

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Faith chain: ${pass}/${pass + fail} passed`);
await b.close(); server.close();
process.exit(fail ? 1 : 0);
