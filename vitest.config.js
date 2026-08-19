import { defineConfig } from "vitest/config";

// The habit module's unit tests cover Layer 2's pure core only — it needs
// no browser, no database, and no DOM, which is the point of keeping the
// arithmetic separate from the fetching. The Worker/OPFS-dependent layers
// are covered by the Playwright suites under tests/habits/acceptance,
// driven against the built app by `npm run test:habits`.
//
// Kahiro's own QA suite (tests/qa.mjs) is a separate Playwright run and
// is deliberately not folded in here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/habits/unit/**/*.test.ts"],
  },
});
