// Customizable pre-trade checklist templates. Each template has named items
// with a mandatory flag; the journal gate requires all mandatory items
// (unless the user enables skipping in settings).
const mk = (text, mandatory = true) => ({ id: `ck${Math.random().toString(36).slice(2, 8)}`, text, mandatory });

export const DEFAULT_CHECKLIST_TEMPLATES = [
  {
    id: "ict", name: "ICT", items: [
      mk("W/D narrative established — HTF bias clear, dealing range identified"),
      mk("Price is in a killzone or ICT Macro window — not random time"),
      mk("Draw on Liquidity (DOL) defined — BSL, SSL, or open gap"),
      mk("Valid ICT model at POI (OB, FVG, BB) confirmed by displacement"),
      mk("Risk ≤ 1% — stop placed beyond model invalidation, not arbitrary"),
      mk("Red folder news checked — no high-impact event within 15 min"),
      mk("Waited for confirmation — no anticipatory entry before displacement"),
    ],
  },
  {
    id: "standard", name: "Standard", items: [
      mk("Trading session confirmed"),
      mk("Higher timeframe analysis completed"),
      mk("Trend identified"),
      mk("Key support & resistance marked"),
      mk("Entry confirmation present"),
      mk("Risk calculated"),
      mk("Position size calculated"),
      mk("Stop Loss placed"),
      mk("Take Profit planned"),
      mk("Minimum Risk-to-Reward met"),
      mk("News checked — no major events affecting the trade", false),
      mk("Trading plan followed"),
      mk("Emotional state checked — no revenge, no FOMO"),
      mk("Account risk limits respected"),
    ],
  },
  {
    id: "scalping", name: "Scalping", items: [
      mk("Session has volatility (London/NY open)"),
      mk("1-min / 5-min structure clear"),
      mk("Spread acceptable"),
      mk("Tight stop placed"),
      mk("Quick R:R target defined"),
      mk("No news in next 15 min"),
      mk("Focused — not tired or distracted"),
    ],
  },
  {
    id: "swing", name: "Swing", items: [
      mk("Daily / 4H bias confirmed"),
      mk("Weekly key level in play"),
      mk("Entry on pullback, not chase"),
      mk("Risk ≤ 1% of account"),
      mk("Wide stop beyond invalidation"),
      mk("Target at next major level"),
      mk("Comfortable holding through swings"),
      mk("Economic calendar checked for the week", false),
    ],
  },
];

export const newChecklistItem = (text = "") => mk(text, false);

// Always returns a usable template — a corrupt/empty store falls back to the
// built-in default rather than crashing the checklist gate.
export function templateById(templates, id) {
  const list = (Array.isArray(templates) ? templates : []).filter((t) => t && Array.isArray(t.items));
  return list.find((t) => t.id === id) || list[0] || DEFAULT_CHECKLIST_TEMPLATES[0];
}

// Across trades, how often each checklist item (by text) was checked, and the
// win rate when it was checked vs skipped — the AI trade-review "edge".
export function checklistEdge(trades) {
  const cl = trades.filter((t) => t.status === "CLOSED" && Array.isArray(t.checklist) && Array.isArray(t.checklistItems) && t.checklistItems.length);
  const map = {};
  cl.forEach((t) => {
    const win = t.outcome === "WIN" || t.outcome === "PARTIAL";
    t.checklistItems.forEach((text, i) => {
      const m = (map[text] = map[text] || { text, checkedW: 0, checkedL: 0, skipW: 0, skipL: 0 });
      const checked = !!t.checklist[i];
      if (checked) { if (win) m.checkedW++; else m.checkedL++; }
      else { if (win) m.skipW++; else m.skipL++; }
    });
  });
  return Object.values(map).map((m) => {
    const chkT = m.checkedW + m.checkedL;
    const skpT = m.skipW + m.skipL;
    return {
      text: m.text,
      checkedWr: chkT ? Math.round((m.checkedW / chkT) * 100) : null,
      skippedWr: skpT ? Math.round((m.skipW / skpT) * 100) : null,
      checkedN: chkT, skippedN: skpT,
    };
  }).sort((a, b) => (b.checkedWr || 0) - (a.checkedWr || 0));
}
