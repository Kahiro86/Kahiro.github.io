// The habit tracker as a Kahiro module.
//
// This was a standalone app with its own `createRoot`. Mounted as a tab it
// keeps every layer intact — Layer 1 in its Worker, Layer 2's pure core,
// Layer 3's three screens — and changes only two things: the page-level
// concerns move into a `.habitapp` wrapper (see tokens.css), and the app
// shell becomes a component instead of a root render.
//
// `standalone.tsx` renders this same component on its own page. The
// acceptance suites drive that page, so they exercise the code that ships
// here rather than a copy of it.
import { useState } from "react";
import { db, onSyncPull } from "./localDb";
import * as logic from "./logic/index";
import type { Habit } from "./logic/dbTypes";
import { ListScreen } from "./ui/ListScreen";
import { DetailScreen } from "./ui/DetailScreen";
import { CalendarScreen } from "./ui/CalendarScreen";
import { HabitEditor } from "./ui/HabitEditor";
import "./ui/tokens.css";

declare global {
  interface Window {
    __db: typeof db;
    __logic: typeof logic;
  }
}

// Exposed for the browser-driven acceptance suites, which exercise
// Layers 1 and 2 directly against the real Worker + OPFS stack.
window.__db = db;
window.__logic = logic;

// Layer 2b §6. A sync pull can change rows for habits whose local write
// counter never moved, so nothing memoised upstairs survives one. Wired
// here rather than inside Layer 2 so the dependency runs downwards:
// Layer 1 announces, the app decides who cares.
onSyncPull(() => logic.cache.clear());

type Route =
  | { screen: "list" }
  | { screen: "detail"; habitId: string }
  | { screen: "calendar"; habitId: string }
  | { screen: "create" }
  | { screen: "edit"; habit: Habit };

function Screens() {
  // One linear path in and back out — a router would be more machinery
  // than the navigation actually has.
  const [route, setRoute] = useState<Route>({ screen: "list" });
  // Bumped whenever the editor writes, so the list re-reads. Without it,
  // a habit created here would not appear until a manual reload.
  const [revision, setRevision] = useState(0);
  const backToList = () => setRoute({ screen: "list" });
  const afterWrite = () => { setRevision((n) => n + 1); backToList(); };

  switch (route.screen) {
    case "create":
      return <HabitEditor onDone={afterWrite} onCancel={backToList} />;
    case "edit":
      return <HabitEditor habit={route.habit} onDone={afterWrite} onCancel={backToList} />;
    case "detail":
      return (
        <DetailScreen
          habitId={route.habitId}
          onBack={() => setRoute({ screen: "list" })}
          onOpenCalendar={() => setRoute({ screen: "calendar", habitId: route.habitId })}
          onEdit={(habit) => setRoute({ screen: "edit", habit })}
        />
      );
    case "calendar":
      return (
        <CalendarScreen
          habitId={route.habitId}
          onBack={() => setRoute({ screen: "detail", habitId: route.habitId })}
        />
      );
    default:
      return (
        <ListScreen
          key={revision}
          onOpenHabit={(habit) => setRoute({ screen: "detail", habitId: habit.id })}
          onAddHabit={() => setRoute({ screen: "create" })}
        />
      );
  }
}

/**
 * The wrapper is not decoration: every style rule the habit tracker owns
 * is scoped beneath this class, so mounting it cannot restyle the module
 * next door.
 */
export function HabitTracker() {
  return (
    <div className="habitapp">
      <Screens />
    </div>
  );
}
