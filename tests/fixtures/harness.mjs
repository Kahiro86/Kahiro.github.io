// ── The browser-audit harness ────────────────────────────────────────
// Seventeen audits carried a byte-identical copy of the same static file
// server and MIME map, sixteen redefined the same date helper, and fifteen
// redefined the same tour-skipper. That is not just repetition: it means a
// fix to any of them lands in one file and silently misses sixteen others.
//
// Nothing here changes behaviour. Every default is the value the copies
// already agreed on, and anything a test varied — the viewport, mostly —
// stays a parameter.
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, join, normalize, resolve, dirname } from "node:path";

/** The repo root. Audits that read source files (not built files) need this:
 *  DIST can point at an external QA snapshot, so `DIST/../src` is not the
 *  repo. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The built app under test. QA_DIST points at an immutable snapshot so a
 *  rebuild mid-run cannot swap hashed filenames underneath a live page. */
export const DIST = process.env.QA_DIST || join(ROOT, "dist");

export const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH
  || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

/** Serves DIST on an ephemeral port. Returns { base, close }. */
export async function serve(dist = DIST) {
  const root = normalize(dist);
  const server = createServer((q, r) => {
    let p = decodeURIComponent((q.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    const fp = normalize(join(root, p));
    // Path traversal guard: a request for ../../etc/passwd must not escape.
    if (!fp.startsWith(root) || !existsSync(fp)) { r.statusCode = 404; return r.end("nf"); }
    r.setHeader("Content-Type", MIME[extname(fp)] || "application/octet-stream");
    r.end(readFileSync(fp));
  });
  await new Promise((r) => server.listen(0, r));
  return {
    base: `http://localhost:${server.address().port}/index.html`,
    close: () => server.close(),
  };
}

// ── Dates ────────────────────────────────────────────────────────────
// Local-timezone, matching src/shared/dates.js:4 exactly. A test that builds
// dates with toISOString() is off by a day for anyone west of UTC, and the
// failure only appears on their machine.
export const iso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
export const TODAY = iso();

/** The full accessible name of a day cell, for addressing the calendar grid
 *  by date rather than by the digits on the tile — the month view repeats
 *  day numbers in its padding rows, so "27" matches twice. */
export const dayLabel = (d = new Date()) =>
  d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/**
 * Boot a page against the built app.
 *
 *   const h = await harness({ seed: world.oneDay() });
 *   ...
 *   await h.close();
 *
 * `seed` is written before any app code runs, guarded so it is applied once
 * and not re-applied on reload — otherwise a persistence assertion is
 * meaningless, because the store is reset behind it on every navigation.
 */
export async function harness({
  seed = null,
  viewport = { width: 1280, height: 1400 },
  dist = DIST,
  settle = 1700,
} = {}) {
  const { base, close: closeServer } = await serve(dist);
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  if (seed) {
    await page.addInitScript((s) => {
      if (localStorage.getItem("__seeded")) return;
      // Always stringify. Passing a string through as-is would be ambiguous
      // — is "3.1" a pre-encoded JSON string, or the value? — and the app
      // JSON.parses every store, so the wrong guess writes a number where a
      // string belongs and the screen renders blank.
      for (const [k, v] of Object.entries(s)) {
        localStorage.setItem(`architect:${k}`, JSON.stringify(v));
      }
      localStorage.setItem("__seeded", "1");
    }, seed);
  }

  const dismiss = async () => {
    for (const n of ["Skip", "Skip the tour"]) {
      const x = page.getByRole("button", { name: n, exact: true });
      try { if (await x.count()) { await x.first().click({ timeout: 1200 }); await page.waitForTimeout(150); } } catch { /* not showing */ }
    }
  };

  /** The page's visible text, whitespace-collapsed. Note that innerText
   *  honours text-transform, so a CSS-uppercased label reads as uppercase —
   *  match case-insensitively. */
  const text = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");

  /** Open a facet by its nav id ("gym", "nutrition", …) and let it settle. */
  const go = async (facet, wait = 1600) => {
    await page.locator(`[data-tour="nav-${facet}"]`).first().click();
    await page.waitForTimeout(wait);
    await dismiss();
    return text();
  };

  await page.goto(base, { waitUntil: "networkidle" });
  await dismiss();
  await page.waitForTimeout(settle);
  await dismiss();
  await page.waitForTimeout(600);

  return {
    page, base, errors, dismiss, text, go,
    close: async () => { await browser.close(); closeServer(); },
  };
}

/** The tally every audit prints, so the runner's last-line summary works. */
export function tally(name) {
  let pass = 0, fail = 0; const fails = [];
  return {
    ok(label, cond) {
      if (cond) { pass++; console.log(`  ✓ ${label}`); }
      else { fail++; fails.push(label); console.log(`  ✗ ${label}`); }
      return !!cond;
    },
    /**
     * Prints the summary and exits with the right code. `failOnError` makes a
     * console error fatal — some audits treat a clean console as part of the
     * claim, and that distinction has to survive the move to this helper.
     */
    done(errors = null, { failOnError = false } = {}) {
      console.log("");
      if (errors) console.log("ERRORS:", errors.slice(0, 3).join(" || ") || "none");
      if (fail) console.log("FAILURES:\n  " + fails.join("\n  "));
      console.log(`${name}: ${pass}/${pass + fail} passed`);
      process.exit(fail || (failOnError && errors && errors.length) ? 1 : 0);
    },
    get counts() { return { pass, fail }; },
  };
}
