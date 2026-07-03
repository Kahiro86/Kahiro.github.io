import { PU, GR, CY, AM, RE, OR } from "../../shared/designTokens.js";

// All times in NY (ICT standard). EAT = NY + 7h (summer EDT) / + 8h (winter EST)
export const SESSION_CONFIG = [
  { id: "cbdr",         label: "CBDR",         nyStart:  0 * 60, nyEnd:  7 * 60, eatLabel: "7:00 AM–2:00 PM EAT",  color: PU },
  { id: "london_open",  label: "London Open",  nyStart:  2 * 60, nyEnd:  5 * 60, eatLabel: "9:00 AM–12:00 PM EAT", color: GR },
  { id: "ny_open",      label: "NY Open",      nyStart:  7 * 60, nyEnd: 10 * 60, eatLabel: "2:00 PM–5:00 PM EAT",  color: CY },
  { id: "london_close", label: "London Close", nyStart: 10 * 60, nyEnd: 12 * 60, eatLabel: "5:00 PM–7:00 PM EAT",  color: AM },
  { id: "ny_lunch",     label: "NY Lunch",     nyStart: 12 * 60, nyEnd: 13 * 60, eatLabel: "7:00 PM–8:00 PM EAT",  color: RE },
  { id: "ny_pm",        label: "NY PM",        nyStart: 13 * 60, nyEnd: 17 * 60, eatLabel: "8:00 PM–Midnight EAT", color: OR },
  { id: "asian",        label: "Asian",        nyStart: 20 * 60, nyEnd: 24 * 60, eatLabel: "3:00 AM–7:00 AM EAT",  color: PU },
];

export const MACRO_CONFIG = [
  { v: "",       l: "None" },
  { v: "m_950",  l: "9:50–10:10 AM NY  (4:50–5:10 PM EAT)" },
  { v: "m_1050", l: "10:50–11:10 AM NY (5:50–6:10 PM EAT)" },
  { v: "m_110",  l: "1:10–1:40 PM NY   (8:10–8:40 PM EAT)" },
  { v: "m_210",  l: "2:10–2:40 PM NY   (9:10–9:40 PM EAT)" },
  { v: "m_315",  l: "3:15–4:00 PM NY   (10:15–11:00 PM EAT)" },
  { v: "m_lo",   l: "London Macro 2:33–3:00 AM NY (9:33–10:00 AM EAT)" },
];

export const SILVER_BULLET_CONFIG = [
  { v: "",      l: "None" },
  { v: "sb_10", l: "10 AM Silver Bullet — 10:00–11:00 AM NY (5:00–6:00 PM EAT)" },
  { v: "sb_14", l: "2 PM Silver Bullet  — 2:00–3:00 PM NY  (9:00–10:00 PM EAT)" },
];

export const ICT_MODELS = [
  "Fair Value Gap (FVG)", "Inverse FVG", "Order Block (OB)", "Breaker Block",
  "Rejection Block", "Propulsion Block", "Balanced Price Range (BPR)",
  "OTE (62–79% Fib)", "Displacement", "SIBI", "BISI",
  "NWOG", "NDOG", "Volume Imbalance", "Liquidity Void",
];

export const SESSIONS_FULL = SESSION_CONFIG.map((s) => ({
  v: s.label,
  l: `${s.label} — ${s.eatLabel}`,
}));

export const LIQ = [
  "BSL (Buy Side Liq)", "SSL (Sell Side Liq)", "EQH", "EQL",
  "PDH", "PDL", "PWH", "PWL", "PMH", "PML",
  "NWOG", "NDOG", "Daily Open", "Weekly Open", "Monthly Open",
  "Session High", "Session Low",
];
export const PO3       = ["Accumulation", "Manipulation / Judas Swing", "Distribution / Delivery"];
export const HTF_TF     = ["Monthly", "Weekly", "Daily"];
export const INT_TF     = ["4H", "1H"];
export const ENTRY_TF   = ["15M", "5M", "1M", "Tick / Flow"];
export const MM_MODELS  = ["Buy Program", "Sell Program", "Judas Swing (Bullish)", "Judas Swing (Bearish)", "None"];
export const PSYCH      = ["Disciplined", "Patient", "Confident", "Process-Focused", "FOMO", "Revenge", "Hesitation", "Overconfident", "Anxious", "Impulsive", "Bored"];
export const ENTRY_Q    = ["Ideal (displaced confirmation)", "On-point", "Slightly early", "Late / chased", "Missed & re-entered"];
export const EXIT_Q     = ["Full target reached", "Took partials — held runner", "Early exit (fear)", "Moved stop to BE too early", "Stopped out correctly", "Stopped out on noise"];
export const GRADES     = ["A+", "A", "A-", "B+", "B", "C"];
export const OUTCOMES   = ["WIN", "LOSS", "BE", "PARTIAL"];
export const INSTRUMENTS = [
  { l: "NQ1!", pv: 20 }, { l: "ES1!", pv: 50 }, { l: "MNQ1!", pv: 2 },
  { l: "MES1!", pv: 5  }, { l: "YM1!", pv: 5  }, { l: "RTY1!", pv: 10 },
  { l: "GC1!", pv: 100 }, { l: "GBPUSD", pv: 10 }, { l: "EURUSD", pv: 10 },
];

export const CHECKLIST = [
  "W/D narrative established — HTF bias clear, dealing range identified",
  "Price is in a killzone or ICT Macro window — not random time",
  "Draw on Liquidity (DOL) defined — BSL, SSL, or open gap",
  "Valid ICT model at POI (OB, FVG, BB) confirmed by displacement",
  "Risk ≤ 1% — stop placed beyond model invalidation, not arbitrary",
  "Red folder news checked — no high-impact event within 15 min",
  "Waited for confirmation — no anticipatory entry before displacement",
];
