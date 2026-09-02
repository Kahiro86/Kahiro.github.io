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

Local-first by default: no server, no account, no sign-in. Everything lives
in the browser and never leaves it. Optional Supabase sync is available if
you want the same journal on your phone and your laptop — see below.

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
src/sync/      optional cloud sync. merge.js is pure and tested too.
src/ui/        primitives, tokens, the chart wrapper, the storage hook.
src/screens/   four screens plus the sync panel. they read and render.
```

`src/engine/` is where every number is decided, which is why `npm test`
proves it with no browser at all. Every expected value in
`tests/engine.test.mjs` is worked out by hand in the comment beside it — a
test whose expectation came from running the code proves only that the
code is deterministic. `tests/merge.test.mjs` does the same for conflict
resolution; both were mutation-tested, so a suite that would still pass
with the logic broken was rewritten rather than trusted.

| File | |
|---|---|
| `trade.js` | The trade record and its arithmetic: risk, net P&L, net R, the outcome. |
| `metrics.js` | Per-trade R metrics, bands and flags for the charts. |
| `sequence.js` | Max drawdown, streaks, the equity curve. |
| `periods.js` | Day/week/month bucketing, aggregation, the sample-size rule. |
| `phases.js` | The phase model, auto-assignment, daylight saving. |
| `charts.js` | All 39 charts, as data rather than as components. |
| `review.js` | A period's statistics, computed from its trades. |
| `../sync/merge.js` | Conflict resolution: union collections by id, honour deletions. |

## Data

Held in `localStorage` under the `pnp:` prefix, with a per-key edit time
kept alongside it in `pnp_meta` so sync can tell which side of a conflict
is actually newer. That is durable enough for daily use and evictable in
principle, so **export a backup** from time to time — the button is in the
Sync & backup panel, and it writes one file with everything in it.

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

## Syncing across devices

Off until you turn it on, and the app is complete without it. To switch it
on you need a Supabase project of your own — the free tier is far more than
this app will ever use.

1. Create a project at supabase.com.
2. In its SQL editor, run the SQL shown under **Sync & backup → The SQL to
   run first** in the app (the cloud button in the header). It creates one
   table and the policy that confines each user to their own rows.
3. Paste the project URL and the *anon public* key from Settings → API into
   the same panel, then create an account and sign in.

### What it does and does not guarantee

Local storage stays the source of truth. Writes are queued, batched and
pushed; other devices pick them up over a realtime channel in a second or
two, with polling as the fallback. Everything keeps working offline and
reconciles on reconnect.

Conflicts do **not** resolve by one device's copy replacing the other's.
Collections merge per record, keyed by id: log a trade on your phone and
another on your laptop while both are offline and you end up with both,
not whichever synced last. Deletes leave a tombstone so a removed trade
does not reappear, and tombstones expire after 90 days — a device offline
longer than that, still holding a trade deleted elsewhere, will bring it
back. `tests/merge.test.mjs` states all of this as assertions.

Settings-shaped keys (`gates`, `seeded`) have no records to merge, so they
stay whole-value last-write-wins by edit time.

The anon key sits in your browser, not in this repository, and is safe to
paste: it grants nothing without a signed-in session. Row Level Security is
what protects the data.

### Sharing a Supabase project with another app

The table is `pnp_kv`, deliberately separate from the `kv` table the Kahiro
OS app syncs to. One project and one login can serve both; separate tables
keep each app's keys out of the other's storage.

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
