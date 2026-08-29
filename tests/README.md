# Tests

## Corruption harness (`qa.mjs`)

Boots the built single-file app (`dist/index.html`) under Chromium and, for
~38 seeded `localStorage` scenarios — a fresh install, every module's store
filled with deliberately malformed data (wrong shapes, `null` entries, bad
JSON, out-of-range values), and known-good states — visits every module and
sub-tab on both desktop and mobile viewports. It asserts that **no screen ever
renders blank or throws**, catching shape-guard regressions before they reach
GitHub Pages.

### Run it

```bash
npm run build          # produce dist/index.html
npm test               # node tests/qa.mjs
# or in one step:
npm run test:ci
```

Playwright resolves its own Chromium (installed via `npx playwright install
chromium`). In sandboxes where the browser lives elsewhere, point at it:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm test
```

Exit code is non-zero if any scenario renders a blank screen, so it gates CI
(`.github/workflows/ci.yml`) on every push and pull request.

### Adding a scenario

Add an entry to `SCENARIOS` keyed by a short name, mapping `architect:`-prefixed
storage keys to raw JSON strings. New modules/sub-tabs go in `MODULES` and the
`SUBTABS` map. Keep seeds intentionally hostile — the point is to prove the
sanitizers hold.

## Fixtures (`tests/fixtures/`)

Shared test data, and the rule that keeps it honest.

| file | what it is |
|---|---|
| `keys.mjs` | Derives the live store-key set from `src/` by reading call sites, not string literals — a key is one that flows through the four APIs that prepend `architect:`. |
| `builders.mjs` | One record at a time: `make.habit()`, `make.meal()`, `make.session()`. Meals take real macros from `FOOD_DB` and throw on a food the library does not have. |
| `scenarios.mjs` | Whole worlds: `freshInstall`, `oneDay`, `partialDay`, `activeMonth`, `richWorld`, `dailyInstrument`, plus the adversarial `corrupt`. |
| `harness.mjs` | `serve()`, `harness()`, `tally()`, and the local-timezone date helpers. Replaces the copy of the static file server that used to sit in seventeen audits. |

### The rule

**A fixture is correct exactly when the app's own sanitizer hands it back
unchanged.** The shape authority is `sanitizeNutrition`, `sanitizeSessions`,
`sanitizeProfile` and friends — never a test's idea of the shape.
`tests/audit/fixture-contract.mjs` enforces it, along with:

1. No test seeds a store the app does not have.
2. Every one of the 88 stores has a fixture.
3. No allowlist entry outlives its drift.
4. `corrupt()` is genuinely rejected — a corruption fixture the sanitizers
   accept is testing nothing.

Both allowlists are currently empty. The rule caught three real defects on the
way in: a profile missing `targetWeightKg`, ten gym sessions in the derived
shape rather than the stored one (dropped silently by `sanitizeSessions`, in
two audits), and forty days of a meal named "Water" that is not in `FOOD_DB`.

### Adding a fixture

Use a builder. If a store has no builder, add one and register its sanitizer in
`SANITIZERS` — then the contract proves your shape rather than trusting it.

## The defect register (`tests/audit/known-defects.mjs`)

Findings from the 2026-08-28 audit, written as demonstrations. Each asserts the
defect is **still present**, so a fix fails the audit and tells you to remove
the entry. Written as ordinary failing tests they would leave the suite
permanently red, and a red suite is one people stop reading.
