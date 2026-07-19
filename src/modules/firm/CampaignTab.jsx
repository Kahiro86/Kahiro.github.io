// ── Campaign — the 5-year map ────────────────────────────────────────
// Where you stand on the road to freedom: twenty quarters, each a mission and
// a gate. Proof-gated, not calendar-gated — you set your position as you clear
// each gate, and the app marks the road and shows live gate status where it
// actually knows it (the Year-1 gate is the real scaling gate).
import { useMemo } from "react";
import { Check, ChevronRight, Flag, Lock } from "lucide-react";
import { BD, T1, T2, T3, GL, B0, AC, GR, AM } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { YEARS, CAMPAIGN, QUARTER_KEYS, indexOf, sanitizeCampaign, campaignProgress } from "../../shared/campaign.js";
import { scalingGate } from "../../shared/firm.js";

const Label = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: T3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{children}</div>
);

export function CampaignTab({ trades, reviews, withdrawals, campaign, setCampaign }) {
  const camp = useMemo(() => sanitizeCampaign(campaign), [campaign]);
  const prog = useMemo(() => campaignProgress(camp), [camp]);
  const curIdx = indexOf(camp.currentQuarter);
  const gate = useMemo(() => scalingGate(trades, reviews, withdrawals), [trades, reviews, withdrawals]);

  const setQuarter = (key) => setCampaign(sanitizeCampaign({ currentQuarter: key }));
  const nextKey = curIdx < QUARTER_KEYS.length - 1 ? QUARTER_KEYS[curIdx + 1] : null;

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 980 }}>
      {/* Position + progress */}
      <Card style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <Label>Current Position</Label>
            <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>{CAMPAIGN[curIdx].name}</div>
            <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Year {CAMPAIGN[curIdx].year} · Q{CAMPAIGN[curIdx].q} — {YEARS[CAMPAIGN[curIdx].year - 1].name}</div>
          </div>
          {nextKey && (
            <button onClick={() => setQuarter(nextKey)}
              style={{ background: AC, border: "none", borderRadius: 10, padding: "9px 13px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              Gate cleared — advance <ChevronRight size={13} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T3, margin: "14px 0 5px" }}>
          <span>{prog.done} of {prog.total} quarters behind you</span><span style={{ fontFamily: "monospace" }}>{prog.pct}%</span>
        </div>
        <div style={{ height: 7, background: GL, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${prog.pct}%`, background: `linear-gradient(90deg,${AC}88,${AC})`, borderRadius: 4 }} />
        </div>
      </Card>

      {/* The road, year by year */}
      {YEARS.map((y) => {
        const quarters = CAMPAIGN.filter((c) => c.year === y.year);
        return (
          <div key={y.year}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "6px 2px 9px" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: T1 }}>Year {y.year} · {y.name}</span>
              <span style={{ fontSize: 11, color: T3, fontStyle: "italic" }}>{y.tagline}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {quarters.map((c) => {
                const i = indexOf(c.key);
                const state = i < curIdx ? "done" : i === curIdx ? "current" : "future";
                const accent = state === "current" ? AC : state === "done" ? GR : BD;
                return (
                  <button key={c.key} onClick={() => setQuarter(c.key)} title={`Set ${c.name} as current`}
                    style={{ textAlign: "left", width: "100%", cursor: "pointer", fontFamily: "inherit",
                      background: state === "current" ? "linear-gradient(110deg,#161616,#0F0F0F)" : B0,
                      border: `1px solid ${state === "current" ? AC + "55" : BD}`, borderLeft: `3px solid ${accent}`,
                      borderRadius: 12, padding: "13px 15px", opacity: state === "future" ? 0.72 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: state === "done" ? `${GR}22` : state === "current" ? `${AC}22` : GL, border: `1px solid ${accent}${state === "future" ? "" : "66"}` }}>
                        {state === "done" ? <Check size={12} color={GR} /> : state === "current" ? <Flag size={11} color={AC} /> : <Lock size={10} color={T3} />}
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: state === "future" ? T2 : T1 }}>Q{c.q} · {c.name}</span>
                      {state === "current" && <span style={{ marginLeft: "auto", fontSize: 9.5, color: AC, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>You are here</span>}
                    </div>
                    {state !== "future" && (
                      <div style={{ fontSize: 11.5, color: T3, marginTop: 7, lineHeight: 1.5 }}>{c.mission}</div>
                    )}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, fontSize: 11, color: state === "current" ? T2 : T3 }}>
                      <span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>GATE</span>
                      <span>{c.gate}</span>
                    </div>
                    {c.liveGate === "scaling" && state === "current" && (
                      <div style={{ marginTop: 9, display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 10px", background: gate.met ? `${GR}14` : `${AM}12`, border: `1px solid ${gate.met ? GR + "44" : AM + "3A"}`, borderRadius: 9, fontSize: 11.5 }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, color: gate.met ? GR : AM }}>{gate.have}/{gate.need}</span>
                        <span style={{ color: T2 }}>{gate.met ? "gate passed — Account #2 unlocks" : "clean months so far (live)"}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
