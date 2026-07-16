// ── Premium black theme ──────────────────────────────────────────────
// Black is the dominant visual identity. A single "dark & dangerous" crimson
// accent drives every interactive element and every former per-module colour
// (full monochrome); only the status hues survive so states stay legible.
// All text/accent pairs target WCAG AA contrast on the black/charcoal base.

// Backgrounds: pure black base, charcoal elevated surfaces.
export const B0 = "#000000", B1 = "#0D0D0D", B2 = "#161616";
// Elevated-surface fills (a faint light lift over black) + hairline borders.
export const GL = "rgba(255,255,255,0.035)", GL2 = "rgba(255,255,255,0.07)";
export const BD = "#2A2A2A", BD2 = "#3A3A3A";
// Text: white → light gray → muted gray.
export const T1 = "#FFFFFF", T2 = "#BDBDBD", T3 = "#7A7A7A";

// Single accent — crimson. CY/PU/OR all alias it so interactive chrome and
// old module-identity colours collapse to one hue across the whole app.
export const AC = "#E5484D", ACD = "#B4343A", ACL = "#FF6B6E";
export const CY = AC, PU = AC, OR = AC;

// Status colours — kept distinguishable, tuned for contrast on black.
export const GR = "#3FB950", AM = "#E3B341", RE = "#F85149", BL = "#4C8DFF";
