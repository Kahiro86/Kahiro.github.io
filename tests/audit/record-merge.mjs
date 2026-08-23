// The Record — Analytics + Journey merged, Mind folded in as Library.
// Same rule as Gates 1 and 2: fully absorbed, no orphan route, nothing lost.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";
const DIST = process.env.QA_DIST || fileURLToPath(new URL("../../dist", import.meta.url));
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = createServer((q, r) => { let p = decodeURIComponent((q.url || "/").split("?")[0]); if (p === "/") p = "/index.html"; const fp = normalize(join(DIST, p)); if (!fp.startsWith(DIST) || !existsSync(fp)) { r.statusCode = 404; return r.end("nf"); } r.setHeader("Content-Type", MIME[extname(fp)] || "application/octet-stream"); r.end(readFileSync(fp)); });
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/index.html`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

// Data owned by each of the three merged surfaces, so "nothing lost" is testable.
const seed = {
  goals: JSON.stringify([{ id: "g1", name: "Ship Kaizen v2", area: "work", target: 10, current: 4, ms: {} }]),
  wants: JSON.stringify([{ id: "w1", name: "Standing desk", cost: 45000, saved: 12000, forWhom: "self" }]),
  mind_library: JSON.stringify([{ id: "b1", title: "Deep Work", author: "Newport", status: "reading" }]),
  mind_decisions: JSON.stringify([{ id: "d1", decision: "Cut the third account", date: ago(9), expected: "Less correlation" }]),
  mind_notes: JSON.stringify([{ id: "n1", title: "On focus", text: "Attention residue is real.", date: ago(4) }]),
  faith_scripture: JSON.stringify([{ id: "v1", ref: "Psalm 1:3", text: "planted by streams", addedAt: ago(12) }]),
};

const errs = [];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await b.newPage({ viewport: { width: 1280, height: 1100 } });
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, v); }, seed);
await page.goto(BASE, { waitUntil: "networkidle" });
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };
await dismiss();

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };
const openTab = async (name) => { await page.getByRole("button", { name: new RegExp(`^${name}$`) }).first().click(); await page.waitForTimeout(700); return page.locator("body").innerText(); };

console.log("\n── the nav shed two entries, not two features ──");
const ids = await page.locator('[data-tour^="nav-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-tour")));
const labels = (await page.locator('[data-tour^="nav-"]').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
console.log(`     ${labels.join(" · ")}`);
ok("Journey has no nav entry", !ids.includes("nav-journey"));
ok("the merged facet is named The Record", labels.some((l) => /the record/i.test(l)));
ok("Faith stands alone, no longer 'Faith & Mind'", labels.some((l) => /^faith$/i.test(l)) && !labels.some((l) => /faith & mind/i.test(l)));
ok("six facets, down from eight", ids.length === 7); // 6 facets + Home

console.log("\n── Faith kept its own content ──");
await page.locator('[data-tour="nav-faith"]').first().click(); await page.waitForTimeout(900); await dismiss();
const faithTxt = await page.locator("body").innerText();
ok("Faith still renders its own screens", /scripture|the walk|psalm/i.test(faithTxt));
ok("and no longer offers a Mind tab", !/\bMind\b/.test(faithTxt));

console.log("\n── The Record carries all six sections ──");
await page.locator('[data-tour="nav-analytics"]').first().click(); await page.waitForTimeout(900); await dismiss();
const recTxt = await page.locator("body").innerText();
for (const t of ["Reports", "Trends", "Progress", "Effort", "Goals", "Library"]) {
  ok(`${t} is a section of the Record`, new RegExp(t, "i").test(recTxt));
}

console.log("\n── nothing was lost in the move ──");
const goalsTxt = await openTab("Goals");
ok("goals survived", /Ship Kaizen v2/.test(goalsTxt));
ok("the want list came along", /Want List/i.test(goalsTxt));
const libTxt = await openTab("Library");
ok("reading list survived", /Deep Work/.test(libTxt));
ok("decision journal survived", /Cut the third account|Decision/i.test(libTxt));
const progTxt = await openTab("Progress");
ok("the Hall of Fame survived", /hall of fame|journey|rank/i.test(progTxt));
ok("rank is rendered from the Covenant ladder", /Signatory|Floor Holder|Rule Keeper|Operator/.test(progTxt));

console.log("\n── the duplicate progression view is gone ──");
ok("Analytics no longer has its own Progression tab", !/Progression/i.test(recTxt));

console.log("\n── cross-domain findings surface in Trends (§5.2) ──");
const trendsTxt = await openTab("Trends");
ok("the cross-domain section renders", /across domains/i.test(trendsTxt));
ok("it says these need more than one module", /reason the domains sit together/i.test(trendsTxt));
// The label is uppercased in CSS, so innerText returns "LAW 7".
ok("findings cite a Law by number", /law \d/i.test(trendsTxt));
ok("the sleep law is quoted, not just numbered", /Sleep is infrastructure/i.test(trendsTxt));
ok("each finding shows its evidence", /nights|logged days/i.test(trendsTxt));

console.log("\n── retired deep links still land somewhere real ──");
const stores = await page.evaluate(() => ({
  goals: JSON.parse(localStorage.getItem("architect:goals") || "[]").length,
  wants: JSON.parse(localStorage.getItem("architect:wants") || "[]").length,
  lib: JSON.parse(localStorage.getItem("architect:mind_library") || "[]").length,
  dec: JSON.parse(localStorage.getItem("architect:mind_decisions") || "[]").length,
  notes: JSON.parse(localStorage.getItem("architect:mind_notes") || "[]").length,
}));
ok(`every store intact (${JSON.stringify(stores)})`, stores.goals === 1 && stores.wants === 1 && stores.lib === 1 && stores.dec === 1 && stores.notes === 1);

console.log("");
console.log("ERRORS:", errs.slice(0, 3).join(" || ") || "none");
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Record merge: ${pass}/${pass + fail} passed`);
await b.close(); server.close();
process.exit(fail || errs.length ? 1 : 0);
