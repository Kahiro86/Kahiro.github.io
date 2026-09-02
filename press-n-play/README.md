<!--
This directory is a complete, self-contained project. It lives here only
because the session that built it could not create a new GitHub repository
(the integration has no repo-creation permission). It is destined for its
own repo — see "Moving this to its own repository" at the bottom — and
nothing at the root of Kahiro.github.io imports from it or builds it.
-->

# PRESS 'N' PLAY

A trading journal. Log the trade, grade it honestly, and let the dashboard
tell you whether the edge is real — and refuse to tell you anything it
does not have the trades to support.

Local-first: no server, no account, no sign-in. Everything lives in the
browser and never leaves it.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 81 engine assertions, no browser needed
npm run build    # → ./dist, a plain static site
```

## What's in it

| Tab | |
|---|---|
| **Journal** | Every trade, newest first, leading with **R** rather than currency. Log and edit trades; risk, planned R:R, net R and the outcome compute live as you type. |
| **Dashboard** | 39 charts — the 34 from the original Notion build, plus profit factor and four the sequence makes possible. |
| **Session Phases** | The fourteen windows of the trading day, plus Custom. Editable, and daylight-saving-aware. |
| **Reviews** | Daily, weekly and monthly. Every number computes itself from the trades in the period. |

## Three ideas it is built on

**R, not money.** A journal that leads with currency teaches you to feel a
big day and a small day differently when they were the same 2R. Net R is
profit measured in units of the risk you took, and it is the only figure
that compares one trade to another honestly.

**Say nothing you cannot support.** Every chart bucket states its `n`.
Buckets under twenty render muted, and a breakdown whose largest bucket is
under twenty says so instead of drawing a ranking you would act on. A
chart whose fields have never been filled in names the field it is waiting
for rather than plotting an invented zero. Under twenty trades the app's
verdict is *"do not conclude anything"*, and it means it.

**Compute it rather than ask for it.** Max drawdown, both streaks and the
equity curve are derived from the order trades happened in. Profit factor
is a division. The session phase comes from the entry time. None of these
is a field you fill in.

## Session phases and daylight saving

Phases are anchored to their session's real open — Tokyo 09:00 JST, London
08:00 UK, New York 09:30 ET — and resolved to local time against the date
of the trade. So an 11:30 entry is **L2** in July and **L1** in January,
and Asia does not move at all, because Japan keeps no daylight saving. You
edit a phase's offset from its session open, which is what a phase
actually is: "the first hour of London".

## The architecture

Three layers, and the boundary is the point.

```
src/engine/    pure functions. no React, no storage, no DOM.
src/ui/        primitives, tokens, the chart wrapper, the storage hook.
src/screens/   four screens. they read the engine and render.
```

`src/engine/` is where every number is decided, which is why it can be
tested by `node tests/engine.test.mjs` with no browser at all. Every
expected value in that file is worked out by hand in the comment beside
it — a test whose expectation came from running the code proves only that
the code is deterministic.

| File | |
|---|---|
| `trade.js` | The trade record and its arithmetic: risk, net P&L, net R, the outcome. |
| `metrics.js` | Per-trade R metrics, bands and flags for the charts. |
| `sequence.js` | Max drawdown, streaks, the equity curve. |
| `periods.js` | Day/week/month bucketing, aggregation, the sample-size rule. |
| `phases.js` | The phase model, auto-assignment, daylight saving. |
| `charts.js` | All 39 charts, as data rather than as components. |
| `review.js` | A period's statistics, computed from its trades. |

## Data

Held in `localStorage` under the `pnp:` prefix. That is durable enough for
daily use and evictable in principle, so **export a backup** from time to
time — `exportAll()` in `src/ui/useStore.js` produces one file with
everything in it.

Nothing derived is ever stored. Risk, R, streaks, drawdown and every
review statistic are recomputed from the trades each time, so an edited
trade can never leave a stale number behind it.

## Where it came from

Rebuilt from a Notion workspace that had grown to 161 properties across
four databases. Much of that structure existed to work around Notion
rather than because the design wanted it: max drawdown and both streaks
were typed in by hand because formulas cannot see neighbouring rows,
profit factor was divided by eye between two tiles, charts filtered on a
price column because filters cannot target a formula, and session phases
were text you edited twice a year for daylight saving.

The intent was worth keeping. The scaffolding was not.

## Moving this to its own repository

Nothing here depends on the repository it is currently sitting in. To give
it its own home and its own Pages site:

```bash
# 1. Create an empty repo named press-n-play on GitHub (public, no README,
#    no .gitignore, no licence).

# 2. From this directory:
git init
git add -A
git commit -m "PRESS 'N' PLAY"
git branch -M main
git remote add origin https://github.com/Kahiro86/press-n-play.git
git push -u origin main

# 3. On GitHub: Settings -> Pages -> Source: "GitHub Actions".
```

`.github/workflows/deploy.yml` then builds on every push to `main` and
publishes to `https://kahiro86.github.io/press-n-play/`. `vite.config.js`
sets `base: "./"`, so the site works at that subpath with no further
configuration.
