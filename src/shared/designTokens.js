// ── Flat black + gold theme ──────────────────────────────────────────
// Pure black, one gold accent, no textures or photos. Every interactive
// element and every former per-module colour collapses to gold, so the whole
// app reads as one calm gold-on-black system. Status hues survive untouched so
// states stay legible. All text/accent pairs target WCAG AA on black.

// Backgrounds: pure black base, charcoal elevated surfaces.
export const B0 = "#000000", B1 = "#0D0D0D", B2 = "#161616";
// Elevated-surface fills (a faint light lift over black) + hairline borders.
export const GL = "rgba(255,255,255,0.035)", GL2 = "rgba(255,255,255,0.07)";
export const BD = "#2A2A2A", BD2 = "#3A3A3A";
// Text: white → light gray → muted gray.
export const T1 = "#FFFFFF", T2 = "#BDBDBD", T3 = "#7A7A7A";

// Primary accent — gold. CY/PU/OR all alias it so interactive chrome and old
// module-identity colours collapse to one hue across the whole app.
export const AC = "#CBA135", ACD = "#9C7C22", ACL = "#E4C463";
export const CY = AC, PU = AC, OR = AC;
// Emphasis gold — a touch brighter, for the brand mark, LVL/XP chrome and
// mission rings. Same family as AC so the app stays mono-gold.
export const AC2 = "#E8B839";

// Status colours — kept distinguishable, tuned for contrast on black.
export const GR = "#3FB950", AM = "#E3B341", RE = "#F85149", BL = "#4C8DFF";

// Type families. SANS drives everything — dense UI and headings alike (heavy
// weights + letter-spacing carry the display voice, matching the flat modern
// look). MONO keeps stacked numerals and code-style labels in tabular
// alignment. SERIF now aliases SANS: the app is sans + mono, no serif.
export const SANS = "'Inter',-apple-system,BlinkMacSystemFont,sans-serif";
export const MONO = "'JetBrains Mono',ui-monospace,monospace";
export const SERIF = SANS;
