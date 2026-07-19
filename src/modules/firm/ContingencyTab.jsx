// ── Contingency — what to do when it breaks ──────────────────────────
// The manual's Part X, verbatim: the pre-decided response to each way the
// plan can take damage — decided now, in calm, so it never has to be decided
// in heat. Pure reference; the value is that it's already written when the bad
// day comes.
import { LifeBuoy, TrendingDown, HeartPulse } from "lucide-react";
import { BD, T1, T2, T3, B0, AC, AM, RE } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";

const FLEET = [
  ["Challenge failed", "No instant rebuy. Full incident review: variance or drift? Variance → rebuy from the fleet fund next month. Drift → process repair first, minimum one month, then rebuy. The fee was tuition either way."],
  ["Funded account breached", "Slot stays empty one full month. Incident review mandatory. The rest of the fleet drops to half size for two weeks — a breach anywhere is evidence about the operator everywhere."],
  ["Third account lost to the same enemy", "Full trading stop, 90 days. The edge isn't the problem; the operator protocol is. Rebuild with a mentor / accountability structure before any capital returns. The kitchen and vault carry the plan meanwhile — that's why they exist."],
  ["Prop firm folds / freezes payouts", "This is why no firm holds >60% of fleet capital and withdrawals run monthly. Write it off gracefully, redistribute to surviving firms, file the lesson. Zero revenge-trading the loss back."],
  ["Edge decays (regime change)", "Detected in the quarterly data review, not in a P&L panic. Fleet to minimum size; the edge re-validated or re-built in analysis blocks; scale returns only with the data's permission."],
];

const LIFE = [
  ["Job loss", "The emergency fund carries 3 months. Chef skills re-deploy fast — the trade is the floor. Fleet trading pauses during the search: a man trading for rent money is a man breaking rules. Vault untouched."],
  ["Injury / illness", "Health outranks every engine. Training to rehab mode, trading to minimum or pause (pain and medication are tilt states), timelines extend without guilt. The plan bends so the man doesn't break."],
  ["Family emergency needing money", "The order: the 10% life share → emergency fund → then and only then a written filter decision about anything more. The vault is last, and touching it requires the 48-hour pause. Generosity is a value; the plan just makes it deliberate."],
  ["Windfall (payout, bonus, gift)", "Windfalls are where discipline dies. Rule: 90 days parked in the MMF before any allocation, then split by the standard formula. No new cars, no “one big trade,” no exceptions inside the window."],
  ["Burnout signals (dread, numbness)", "Named in advance as a system alarm, not weakness. Response: one full recovery week — sleep, food, faith, zero trading — then a season review. The six-day pace is a season because this branch exists."],
];

const Group = ({ icon, title, sub, rows, color }) => (
  <Card style={{ padding: "16px 18px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 800, color: T1 }}>{title}</span>
    </div>
    <div style={{ fontSize: 11, color: T3, fontStyle: "italic", marginBottom: 13 }}>{sub}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map(([event, response]) => (
        <div key={event} style={{ background: B0, border: `1px solid ${BD}`, borderLeft: `3px solid ${color}`, borderRadius: 11, padding: "12px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T1, marginBottom: 4 }}>{event}</div>
          <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{response}</div>
        </div>
      ))}
    </div>
  </Card>
);

export function ContingencyTab() {
  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 860 }}>
      <Card style={{ padding: "16px 18px", background: `linear-gradient(180deg,${AC}0C,transparent)`, display: "flex", alignItems: "center", gap: 11 }}>
        <LifeBuoy size={18} color={AC} style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T1 }}>Contingency Trees</div>
          <div style={{ fontSize: 11.5, color: T3, marginTop: 2 }}>Plans fail at the branch nobody mapped. Here's what the firm does when each thing breaks — decided now, in calm, so it never has to be decided in heat.</div>
        </div>
      </Card>

      <Group icon={<TrendingDown size={15} color={RE} />} color={RE}
        title="When the fleet takes damage" sub="Trading contingencies" rows={FLEET} />
      <Group icon={<HeartPulse size={15} color={AM} />} color={AM}
        title="When life takes a swing" sub="Life contingencies" rows={LIFE} />
    </div>
  );
}
