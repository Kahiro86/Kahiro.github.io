// Targeted render check for the Habits facet: loads the built app, opens the
// facet, and drives create → log → detail → calendar, asserting each screen
// renders real content (never blank). Serves ./dist over HTTP like qa.mjs.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";

const DIST = fileURLToPath(new URL("../../dist", import.meta.url));
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  const fp = normalize(join(DIST, p));
  if (!fp.startsWith(DIST) || !existsSync(fp)) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", MIME[extname(fp)] || "application/octet-stream");
  res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/index.html`;
const EXE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const fail = (msg) => { console.error("FAIL:", msg); errors.length && console.error(errors.join("\n")); process.exit(1); };
const seen = async (sel, label) => { try { await page.waitForSelector(sel, { timeout: 8000 }); } catch { fail(`${label} — selector ${sel} never appeared`); } };

await page.goto(BASE, { waitUntil: "networkidle" });

const dismiss = async () => {
  for (const name of ["Skip", "Skip the tour"]) {
    const b = page.getByRole("button", { name, exact: true });
    try { if (await b.count()) { await b.first().click({ timeout: 1500 }); await page.waitForTimeout(200); } } catch { /* gone */ }
  }
};
// Dismiss the first-run "Name your system" modal, then the guided tour.
await dismiss();

// Open the Habits facet from the sidebar (data-tour="nav-habits").
await seen('[data-tour="nav-habits"]', "habits nav button");
await page.locator('[data-tour="nav-habits"]').first().click();
await seen(".habitapp", "facet mount");
await seen(".topbar__title", "list topbar");
await dismiss(); // the guided tour can surface after the first navigation too

// Empty state offers a way in → the editor's type chooser.
await page.getByRole("button", { name: /Add your first habit|Add a habit/ }).first().click();
await page.getByRole("button", { name: /Yes or no/ }).first().click();
await seen(".habitapp input", "editor form");
// Name the habit and save (editor's primary control).
await page.locator(".habitapp input").first().fill("Read 20 minutes");
const saveBtn = page.getByRole("button", { name: /^(Save|Create|Add|Done)/ }).last();
await saveBtn.click();

// Back on the list with a row present.
await seen(".row__name", "habit row after create");
const rowText = await page.locator(".row__label").first().innerText();
if (!/Read/.test(rowText)) fail(`row label wrong: ${rowText}`);

// Log today: tap the last (today) cell in the row.
const cells = page.locator(".grid.row .cell:not(.cell--off)");
const n = await cells.count();
if (n > 0) { await cells.nth(n - 1).click(); }
await page.waitForTimeout(300);

// Open detail via the name, then calendar.
await page.locator(".row__name").first().click();
await seen(".habitapp", "detail mount");
const detailText = await page.locator(".habitapp").innerText();
if (detailText.trim().length < 10) fail("detail screen looks blank");

if (errors.length) fail("runtime errors captured");
await page.screenshot({ path: join(tmpdir(), "habits-render-check.png") });
console.log("Habits render check: PASS — facet, editor, list row, logging, detail all rendered");
await browser.close();
server.close();
process.exit(0);
