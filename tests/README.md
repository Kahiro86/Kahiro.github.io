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
