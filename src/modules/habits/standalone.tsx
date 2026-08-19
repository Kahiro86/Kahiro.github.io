// The habit tracker on a page of its own, at /habits.html.
//
// Same build, same component, same bundle graph as the Kahiro tab — this
// entry adds a root and nothing else. It exists because the 141 habit
// acceptance tests drive the real Worker and OPFS through a browser, and
// routing every one of them through Kahiro's shell (lock screen,
// onboarding, lazy module loading) would test Kahiro's navigation rather
// than the habit tracker's data layer.
//
// It is also the honest answer to "does this still work on its own",
// which matters while the Kahiro migration is still ahead of us.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HabitTracker } from "./HabitTracker.js";
import "./standalone.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HabitTracker />
  </StrictMode>,
);
