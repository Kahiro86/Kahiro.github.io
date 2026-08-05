// ── Help content & guided-tour definitions ──────────────────────────
// The teaching layer's data: a searchable Help Centre library plus the
// step lists the spotlight walkthrough runs. Kept as plain data so the UI
// (HelpCenter.jsx, GuidedTour.jsx) stays dumb and this stays easy to edit.

// Each tour step: { target?, title, body, module?, placement? }
//  · target   — value of a data-tour="…" attribute to spotlight. Omitted →
//               a centred card (used for intro/outro and mobile fallback).
//  · module   — switch the app to this module before showing the step.
//  · placement— preferred tooltip side ("auto" default).
export const TOUR_OVERVIEW = {
  id: "overview",
  title: "App tour",
  steps: [
    { title: "Welcome to Kahiro", body: "Your personal operating system for continuous improvement. The rule here is simple: consistency over perfection. Let's take 30 seconds to see the map." },
    { target: "nav-dashboard", module: "dashboard", title: "Command Center", body: "Your daily cockpit — today's focus, streaks, and one clear next action. Start here every morning." },
    { target: "nav-life", module: "dashboard", title: "Life OS", body: "Habits & routines, your journal, projects and purity — plus Athlete OS: workouts, nutrition and body measurements." },
    { target: "nav-firm", module: "dashboard", title: "The Firm", body: "The Machine: your trading journal and reviews, income, budget, net worth and the wealth engine that funds your freedom." },
    { target: "nav-faith", module: "dashboard", title: "Faith & Mind", body: "The inner build: scripture memory & devotion, reading momentum, and a decision journal." },
    { target: "nav-journey", module: "dashboard", title: "Journey", body: "Your goals, want list, and the Hall of Fame — level, XP and achievements earned from everything you do." },
    { target: "nav-analytics", module: "dashboard", title: "Analytics", body: "The mirror. Trends and patterns across every module, so the numbers tell you the truth." },
    { target: "more-btn", module: "dashboard", title: "Help is always here", body: "The More (⋯) menu holds Search, Who I Am, and Help — open it anytime to reach the Help Centre, turn on Help Mode, or replay this tour. You can never get lost." },
    { title: "You're set", body: "That's the whole map. Don't try to master it all today — pick one habit, log it, and come back tomorrow. Momentum compounds." },
  ],
};

export const TOURS = { overview: TOUR_OVERVIEW };

// ── Help Centre library ──────────────────────────────────────────────
// Categories order = display order. Articles carry a category id, title,
// tags (searched), and a body of { h?, p?, list? } blocks.
export const HELP_CATEGORIES = [
  { id: "start", label: "Getting Started" },
  { id: "modules", label: "Feature Guides" },
  { id: "faq", label: "FAQ" },
  { id: "trouble", label: "Troubleshooting" },
  { id: "tips", label: "Tips & Tricks" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "whatsnew", label: "What's New" },
];

const P = (text) => ({ p: text });
const H = (text) => ({ h: text });
const L = (items) => ({ list: items });

export const HELP_ARTICLES = [
  // ── Getting Started ──
  {
    id: "philosophy", cat: "start", title: "The philosophy: consistency over perfection",
    tags: "kaizen improvement streak philosophy why start",
    body: [
      P("Kahiro is built on one idea — kaizen, continuous improvement. You don't win by being perfect for a day; you win by showing up, logging honestly, and stacking small wins until they compound."),
      P("Every streak, level and chart here rewards returning, not flawlessness. A missed day is data, not failure. A rest day or cheat day is planned recovery, not a break in the chain."),
      L(["Show up daily, even for 2 minutes.", "Log the truth — the mirror only helps if it's honest.", "Let the numbers guide the next small adjustment."]),
    ],
  },
  {
    id: "first-steps", cat: "start", title: "Your first 5 minutes",
    tags: "setup begin first habit goal onboarding new",
    body: [
      H("1. Start on the Command Center"), P("It shows today's focus and your single most important next action."),
      H("2. Add one habit"), P("Open Life OS → Habits and add a single non-negotiable. One is enough to begin."),
      H("3. Set one goal"), P("Open Journey → Goals and write down what you're building toward."),
      H("4. Come back tomorrow"), P("Tap it done. That's the whole game — repeated."),
    ],
  },
  {
    id: "help-mode", cat: "start", title: "Help Mode, tours and this Help Centre",
    tags: "help mode tour walkthrough replay guide onboarding tooltip",
    body: [
      P("You can always relearn the app. Three tools:"),
      L([
        "App tour — a guided, highlighted walkthrough. Replay it anytime from Settings → Help & Guide.",
        "Help Mode — turns on small (?) markers next to key features; tap one for a quick explanation. Toggle it in Settings.",
        "Help Centre — this searchable library. Search any feature by name.",
      ]),
    ],
  },
  // ── Feature Guides (per module) ──
  {
    id: "m-dashboard", cat: "modules", title: "Command Center",
    tags: "dashboard command center cockpit today focus streak mission life score",
    body: [
      P("Purpose: a 3-to-5-second glance at what matters today and the one action to take next."),
      H("Key features"), L(["Today's mission and non-negotiables", "Life Score and current streaks", "Priority alerts that only appear when something needs you", "Year of Consistency — your day count and rate"]),
      H("Best practices"), L(["Open it first each day.", "Clear the primary action before anything else."]),
      H("Avoid"), L(["Doom-scrolling the numbers — it's a launchpad, not a destination."]),
      H("Connects to"), P("Reads from every module — habits, trading, finance, workouts — and links straight to whatever needs attention."),
    ],
  },
  {
    id: "m-life", cat: "modules", title: "Life OS (Habits, Journal, Athlete)",
    tags: "life os habits routines journal projects purity athlete workout nutrition body rest cheat streak",
    body: [
      P("Purpose: the engine of the daily you — habits & routines, journaling, and Athlete OS (training, nutrition and body composition)."),
      H("Key features"), L(["Habits with schedules, streaks and routines that complete several at once", "Journal with backdating", "Athlete: workouts, weekly split, nutrition logging and body measurements", "Rest days and cheat days that keep streaks safe"]),
      H("Best practices"), L(["Bundle a morning routine so one tap logs several habits.", "Log workouts and meals the same day — trends beat precision.", "Mark a genuine rest or cheat day rather than breaking the chain."]),
      H("Avoid"), L(["Adding 20 habits at once. Start with 1–3 non-negotiables."]),
      H("Connects to"), P("Feeds streaks and XP to the Command Center, Journey and Analytics."),
    ],
  },
  {
    id: "m-firm", cat: "modules", title: "The Firm (Trading, Finance, Wealth)",
    tags: "firm trading journal reviews finance income budget net worth debt portfolio vault gate wealth machine",
    body: [
      P("Purpose: the Machine that funds your freedom — a disciplined trading journal plus your whole financial picture."),
      H("Key features"), L(["Trading journal with a pre-trade checklist, analytics and scheduled reviews", "Income, budget, accounts, emergency fund and debt in one Money view", "Net worth, portfolio and the wealth/withdrawal engine"]),
      H("Best practices"), L(["Fill the checklist before every trade, review on the cadence.", "Log income and update balances monthly.", "Firewall trading capital from net worth so a drawdown doesn't distort the mission."]),
      H("Avoid"), L(["Logging trades without reviewing them — the review is where the edge compounds."]),
      H("Connects to"), P("Feeds the Command Center's money snapshot and the freedom mission math."),
    ],
  },
  {
    id: "m-faith", cat: "modules", title: "Faith & Mind",
    tags: "faith mind scripture memory devotion word reading books decisions journal spiritual",
    body: [
      P("Purpose: the inner build — spiritual consistency and clear thinking."),
      H("Key features"), L(["The Word: reflections woven with spaced-repetition scripture memory", "The Walk: spiritual-habit consistency over months", "Reading momentum and a decision journal"]),
      H("Best practices"), L(["Write a short reflection daily; memorise one verse at a time.", "Log decisions with your reasoning so you can review outcomes later."]),
      H("Connects to"), P("Spiritual habits live in the shared habit engine, so Life OS and the cockpit see them too."),
    ],
  },
  {
    id: "m-journey", cat: "modules", title: "Journey (Goals, Want List, Hall of Fame)",
    tags: "journey goals want list wishlist hall of fame xp level achievements rewards",
    body: [
      P("Purpose: what you're aiming at, and proof of how far you've come."),
      H("Key features"), L(["Universal goals with progress", "Want List — things to buy/save toward, funded over time", "Hall of Fame: your level, XP and achievements"]),
      H("Best practices"), L(["Keep goals few and specific.", "Let achievements be a byproduct of consistency, not the target."]),
      H("Connects to"), P("Goals can auto-progress from real data; XP is earned from every module."),
    ],
  },
  {
    id: "m-xp", cat: "modules", title: "XP, levels & achievements",
    tags: "xp level experience achievements hall of fame points rank progression rewards",
    body: [
      P("Purpose: a hidden scoring layer that turns real actions into progress you can feel."),
      H("How it works"), L(["XP is derived from your actual records — logging a habit, a workout, a trade review, a reflection.", "It's never stored directly, so it can't be gamed and always reflects the truth.", "Levels and achievements unlock as your consistency grows."]),
      H("Avoid"), L(["Chasing XP for its own sake. Do the work; the XP follows."]),
      H("Connects to"), P("Shown in the header and the Journey → Hall of Fame."),
    ],
  },
  {
    id: "m-analytics", cat: "modules", title: "Analytics",
    tags: "analytics trends charts patterns mirror reports data insight",
    body: [
      P("Purpose: the mirror — cross-module trends so you can see patterns you'd otherwise miss."),
      H("Key features"), L(["Trends over time across habits, training, trading and finance", "Weekday and consistency patterns", "Honest reports, no vanity metrics"]),
      H("Best practices"), L(["Review weekly, not obsessively. Look for one thing to adjust."]),
    ],
  },
  {
    id: "m-settings", cat: "modules", title: "Settings, backup & cloud sync",
    tags: "settings backup export cloud sync account lock pin clean copy data help",
    body: [
      P("Purpose: control your data, security and the app itself."),
      H("Key features"), L(["Back up and restore all your data", "Optional cloud sync across devices with your own account", "App Lock (PIN) and auto-lock", "Help & Guide: replay the tour, toggle Help Mode"]),
      H("Best practices"), L(["Back up before big changes.", "Turn on cloud sync if you use more than one device."]),
    ],
  },
  // ── FAQ ──
  {
    id: "faq-data", cat: "faq", title: "Where is my data stored? Is it private?",
    tags: "data storage private cloud local device account sync security",
    body: [
      P("Everything lives in your own browser on your device by default. Nothing is sent anywhere unless you switch on cloud sync and connect your own account."),
      P("The app itself contains none of your data — so someone opening the same app on their phone starts completely empty and can never see yours."),
    ],
  },
  {
    id: "faq-devices", cat: "faq", title: "Can I use it on more than one device?",
    tags: "devices phone laptop sync multiple two devices",
    body: [P("Yes — turn on Cloud Sync in Settings and sign in with the same account on each device. Your data follows you; each account stays private and separate.")],
  },
  {
    id: "faq-offline", cat: "faq", title: "Does it work offline?",
    tags: "offline internet connection pwa install airplane",
    body: [P("Yes. Install it to your home screen (your browser's 'Add to Home Screen') and it works offline like a normal app. Changes sync when you're back online if cloud sync is on.")],
  },
  {
    id: "faq-streak", cat: "faq", title: "I missed a day — did I lose everything?",
    tags: "missed day streak lost reset broken rest cheat",
    body: [P("No. A missed day only pauses momentum. Rest days and cheat days are streak-safe on purpose. Just return — returning is the win, and the numbers reward it.")],
  },
  // ── Troubleshooting ──
  {
    id: "tr-blank", cat: "trouble", title: "A page looks blank or stuck",
    tags: "blank stuck frozen crash reload refresh broken bug",
    body: [
      P("Try, in order:"),
      L(["Pull to refresh / reload the app.", "Close and reopen it.", "Settings → back up your data first, then if needed restore it.", "If a screen stays broken, the app keeps your data safe — it won't be deleted by a reload."]),
    ],
  },
  {
    id: "tr-sync", cat: "trouble", title: "Cloud sync isn't updating",
    tags: "sync not working cloud account offline conflict devices",
    body: [L(["Check you're signed into the same account on both devices.", "Make sure both have internet.", "Open the app on each device to let it pull the latest.", "Most recent change wins if the same thing was edited in two places."])],
  },
  // ── Tips ──
  {
    id: "tip-routines", cat: "tips", title: "Bundle habits into routines",
    tags: "routine bundle morning night one tap habits tip",
    body: [P("In Life OS, group your morning or gym habits into a routine. One tap then completes the whole block — far less friction than logging each habit alone.")],
  },
  {
    id: "tip-backdate", cat: "tips", title: "Forgot to log? Backdate it",
    tags: "backdate past date log yesterday history date picker tip",
    body: [P("Habits, nutrition, journal, workouts, trades and reflections all have a date picker. Set it to the day it actually happened — your streaks and stats stay honest.")],
  },
  {
    id: "tip-restcheat", cat: "tips", title: "Use rest days and cheat days",
    tags: "rest day cheat day recovery streak safe planned tip",
    body: [P("Mark a rest day in Athlete → Weekly and a cheat day next to the nutrition date. Both keep your streak intact — planned recovery beats a broken chain.")],
  },
  // ── Shortcuts ──
  {
    id: "sc-list", cat: "shortcuts", title: "Keyboard & gesture shortcuts",
    tags: "keyboard shortcuts gestures esc quick log keys",
    body: [
      L([
        "Esc — close an open panel or modal (Settings, Week in Review, Help).",
        "Quick-Log button — the floating pill logs your habits from anywhere.",
        "Tap the header ? — open this Help Centre.",
      ]),
      P("More shortcuts arrive as the desktop experience grows."),
    ],
  },
  // ── What's New ──
  {
    id: "wn-guide", cat: "whatsnew", title: "New: interactive guide & Help Centre",
    tags: "whats new update guide tour help mode help centre onboarding",
    body: [
      P("You can now learn the whole app without a manual:"),
      L(["A guided, highlighted app tour (replayable from Settings).", "Help Mode — (?) markers on key features.", "This searchable Help Centre.", "Rest days and cheat days that keep your streaks safe."]),
    ],
  },
];

// Case-insensitive search across title, tags and body text.
export function searchHelp(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return HELP_ARTICLES;
  const terms = q.split(/\s+/);
  return HELP_ARTICLES.filter((a) => {
    const hay = `${a.title} ${a.tags} ${a.body.map((b) => b.h || b.p || (b.list || []).join(" ")).join(" ")}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
