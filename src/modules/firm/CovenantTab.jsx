// ── Covenant — the laws, signed to yourself ──────────────────────────
// The doctrine's spine, verbatim from the field manual's Part XII: who this
// builds (Batman/Stark), the Ten Laws that hold for all five years, and a
// signature the app makes real — signed once, dated, and kept.
import { ScrollText, Check, PenLine } from "lucide-react";
import { BD, T1, T2, T3, GL, B2, AC, GR } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { sanitizeCovenant } from "../../shared/firm.js";

const TEN_LAWS = [
  ["Prove one, then multiply.", "No account #2 until #1 has paid three clean months of withdrawals."],
  ["Scale by count, never by force.", "3–6%/month per account. The 33% demand is the account-killer, always."],
  ["One loss = done.", "Per account, per day. The re-entry urge is the exit signal."],
  ["Kill correlation.", "Aggregate risk ≤1.5%; one event must never breach the fleet."],
  ["The vault is one-way.", "It funds nothing but freedom."],
  ["Sovereign over rented.", "Every year, weight migrates from their capital to yours."],
  ["Sleep is infrastructure.", "The 6.5-hour floor outranks every opportunity."],
  ["Expenses stay frozen.", "The KSh 30K life is the superpower; raise income, never the burn."],
  ["Audit like a firm.", "Daily card, weekly audit, monthly review, quarterly gate — numbers before feelings."],
  ["It's a season with an exit.", "Grind hard, on purpose, to never have to again — and the date is named by you."],
];

const SIGNATURE = [
  "I will judge myself by rules held, not money made.",
  "I will prove one before I multiply.",
  "I will protect the floor — sleep, budget, vault — above every ceiling.",
];

const Label = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: T3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{children}</div>
);

export function CovenantTab({ covenant, setCovenant }) {
  const cov = sanitizeCovenant(covenant);
  const signed = !!cov.signedAt;
  const signedDate = signed ? new Date(cov.signedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}>
      {/* Mission / the two figures */}
      <Card style={{ padding: "18px 20px", background: `linear-gradient(180deg,${AC}0C,transparent)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <ScrollText size={15} color={AC} />
          <Label>The Doctrine</Label>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: T1, lineHeight: 1.5 }}>
          The mission was never money. The mission is freedom — a life where your hours belong to you.
        </div>
        <div style={{ fontSize: 12.5, color: T2, marginTop: 10, lineHeight: 1.65 }}>
          <b style={{ color: T1 }}>Batman</b> is the internal build — the man who holds the line when no one is watching.
          <b style={{ color: T1 }}> Stark</b> is the machine — a fleet, a vault, a name that carries weight. Stark without
          Batman blows funded accounts; Batman without Stark is a monk with no exit. This plan forges both, on purpose.
        </div>
      </Card>

      {/* The Ten Laws */}
      <Card style={{ padding: "16px 18px" }}>
        <Label>The Ten Laws of the Firm</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {TEN_LAWS.map(([law, detail], i) => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, fontSize: 14, color: AC, width: 22, flexShrink: 0, textAlign: "right" }}>{i + 1}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{law}</div>
                <div style={{ fontSize: 11.5, color: T3, marginTop: 2, lineHeight: 1.5 }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* The signature */}
      <Card style={{ padding: "18px 20px" }}>
        <Label>The Signature</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {SIGNATURE.map((line, i) => (
            <div key={i} style={{ fontSize: 13, color: T1, fontStyle: "italic", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: AC }}>—</span>{line}
            </div>
          ))}
        </div>
        {signed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 11, color: T1, fontSize: 13 }}>
            <Check size={16} color={GR} /> Signed {signedDate}. <span style={{ color: T3 }}>Reviewed annually.</span>
          </div>
        ) : (
          <button onClick={() => setCovenant({ signedAt: new Date().toISOString() })}
            style={{ width: "100%", background: AC, border: "none", borderRadius: 11, padding: "12px 0", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <PenLine size={15} /> Sign the covenant
          </button>
        )}
        <div style={{ fontSize: 11, color: T3, marginTop: 12, textAlign: "center", letterSpacing: 1 }}>Prove one. Multiply. Own it all.</div>
      </Card>
    </div>
  );
}
