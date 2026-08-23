// ── Faith ────────────────────────────────────────────────────────────
// Mind moved into the Record facet as Library. What was left here was a tab
// bar with one tab, which is not a tab bar — so Faith is simply itself now.
import { FaithCore } from "./FaithCore.jsx";

export function FaithOS({ habits, setHabits, loaded = true } = {}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <FaithCore habits={habits} setHabits={setHabits} loaded={loaded} />
    </div>
  );
}
