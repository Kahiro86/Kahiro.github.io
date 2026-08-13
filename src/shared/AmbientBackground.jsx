// ── Ambient background — flat black ──────────────────────────────────
// The app's identity is now pure flat black: no photos, no collage, no noise
// texture, no drifting particles. This renders a single fixed black layer
// behind the glass UI. (Kept as a component so mounts elsewhere stay valid.)
import { B0 } from "./designTokens.js";

export function AmbientBackground() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, background: B0, pointerEvents: "none" }} />
  );
}
