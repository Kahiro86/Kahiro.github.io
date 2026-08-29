// The app on a phone. Every other browser audit runs at 1280-1400px wide,
// and this is a PWA people install on a Home Screen — so the width nothing
// had ever been checked at is the one it is actually used at.
//
// Horizontal overflow is the specific defect being hunted. It is invisible
// on desktop, obvious and miserable on a phone, and usually caused by one
// unwrapped row or a fixed pixel width somewhere in a flex chain. The page
// body must never scroll sideways; a wide table or chart may, inside its
// own container.
import { chromium } from "playwright";
import { serve, CHROMIUM } from "../fixtures/harness.mjs";
import { richWorld } from "../fixtures/scenarios.mjs";

const { base: BASE, close: closeServer } = await serve();

// The same world console-clean walks, so a screen that renders on desktop and
// breaks at 390px differs by the viewport and nothing else. Both audits used
// to carry their own copy of it, and both copies had the same wrong session
// shape — see richWorld()'s note.
const seed = richWorld();

// Noise that is not a defect: a dev-only React notice, a favicon 404 from
// the throwaway static server, a deliberate offline no-op.
const IGNORE = [
  /Download the React DevTools/i,
  /favicon/i,
  /Failed to load resource.*404.*(icon|manifest|apple-touch)/i,
  /ServiceWorker|serviceWorker registration/i,
];
const noisy = (t) => IGNORE.some((re) => re.test(t));

const ROUTES = ["dashboard", "habits", "gym", "faith", "calendar", "analytics", "firm"];

let pass = 0, fail = 0; const fails = [];
const ok = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; fails.push(n); console.log(`  ✗ ${n}`); } };

const b = await chromium.launch({ executablePath: CHROMIUM });
// iPhone 14 / Pixel-class portrait, the common install size.
const VW = 390;
const page = await b.newPage({ viewport: { width: VW, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

const seen = [];
page.on("pageerror", (e) => seen.push({ kind: "pageerror", text: String(e) }));
page.on("console", (m) => {
  const t = m.text();
  if ((m.type() === "error" || m.type() === "warning") && !noisy(t)) seen.push({ kind: m.type(), text: t });
});

await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(`architect:${k}`, JSON.stringify(v)); }, seed);
const dismiss = async () => { for (const n of ["Skip", "Skip the tour"]) { const x = page.getByRole("button", { name: n, exact: true }); try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { } } };

await page.goto(BASE, { waitUntil: "networkidle" });
await dismiss(); await page.waitForTimeout(1800); await dismiss(); await page.waitForTimeout(600);

console.log(`\nWalking every facet at ${VW}px\n`);
for (const route of ROUTES) {
  const before = seen.length;
  try {
    await page.locator(`[data-tour="nav-${route}"]`).first().click({ timeout: 5000 });
    await page.waitForTimeout(2200);
    await dismiss();
    // Open whatever sub-tabs the facet offers — a chart that only renders on
    // the third tab is exactly where a stale prop hides.
    const tabs = await page.locator('[role="tab"], .tab, button').all();
    for (const t of tabs.slice(0, 14)) {
      try {
        const label = (await t.innerText()).trim();
        if (!label || label.length > 22 || /delete|remove|reset|clear|log out|import/i.test(label)) continue;
        await t.click({ timeout: 1200 });
        await page.waitForTimeout(500);
      } catch { /* not clickable; fine */ }
    }
  } catch { /* route may not exist on this layout */ }
  const found = seen.slice(before);
  ok(`${route.padEnd(10)} no console errors${found.length ? ` — ${found.slice(0, 2).map((f) => f.text.slice(0, 90)).join(" | ")}` : ""}`, found.length === 0);

  // The page itself must not scroll sideways. Anything genuinely wide is
  // allowed to, inside its own overflow container — so measure the document,
  // then name the widest element when it fails, because "something is too
  // wide" is not a bug report.
  const over = await page.evaluate((vw) => {
    const doc = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (doc <= vw + 1) return null;
    let worst = null;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const right = r.right;
      if (right > vw + 1 && (!worst || right > worst.right)) {
        worst = { right: Math.round(right), tag: el.tagName.toLowerCase(),
          cls: (typeof el.className === "string" ? el.className : "").slice(0, 40),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 45) };
      }
    }
    return { doc: Math.round(doc), worst };
  }, VW);
  ok(`${route.padEnd(10)} no sideways scroll${over ? ` — ${over.doc}px wide; worst: <${over.worst?.tag} class="${over.worst?.cls}"> reaching ${over.worst?.right}px "${over.worst?.text}"` : ""}`, over === null);

  // A control taller than the viewport or pushed off-screen cannot be tapped.
  const offscreen = await page.evaluate((vw) => {
    const bad = [];
    for (const el of document.querySelectorAll("button, [role=button], a, input, select, textarea")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -1 || r.right > vw + 1) {
        bad.push(`<${el.tagName.toLowerCase()}> "${(el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34)}"`);
      }
    }
    return bad.slice(0, 3);
  }, VW);
  ok(`${route.padEnd(10)} every control is on screen${offscreen.length ? ` — ${offscreen.join(", ")}` : ""}`, offscreen.length === 0);
}

console.log("");
if (seen.length) {
  console.log("ALL MESSAGES:");
  const uniq = [...new Map(seen.map((s) => [s.text.slice(0, 160), s])).values()];
  for (const s of uniq.slice(0, 20)) console.log(`  [${s.kind}] ${s.text.slice(0, 220)}`);
  console.log("");
}
if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
console.log(`Mobile layout: ${pass}/${pass + fail} checks across ${ROUTES.length} routes at ${VW}px`);
await b.close(); closeServer();
process.exit(fail ? 1 : 0);
