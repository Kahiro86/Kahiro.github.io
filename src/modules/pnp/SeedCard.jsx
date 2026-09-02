// ── The Notion import, offered once ──────────────────────────────────
// Phases seed themselves — they are configuration, and an empty phase
// table would just break the timing charts. Accounts and the trade do
// not: they write into ti_trades and ti_accounts, which Trading OS and
// seven other modules read. Writing to a shared store on somebody's
// behalf, silently, on first render, is not a thing to do.
//
// So it is a card you press, it says exactly what it will write, and it
// never runs twice.
import { useState } from "react";
import { Download, Check } from "lucide-react";
import { BD, T1, T2, T3, AC, AC2, GR, MONO } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { buildSeed, SEED_ACCOUNTS, SEED_TRADE } from "./engine/seed.js";

export function SeedCard({ accounts, trades, onSeed, onDismiss }) {
  const [done, setDone] = useState(null);
  const plan = buildSeed({ accounts, trades });
  const nothingToDo = !plan.accounts.length && !plan.trades.length;

  if (done) {
    return (
      <Card style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <Check size={14} style={{ color: GR }} />
        <span style={{ fontSize: 11.5, color: T2 }}>{done}</span>
      </Card>
    );
  }

  return (
    <Card style={{ padding: "13px 15px", display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Download size={13} style={{ color: AC2 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T1 }}>Bring across what was in Notion</span>
      </div>
      <div style={{ fontSize: 11, color: T3, lineHeight: 1.6 }}>
        {nothingToDo ? (
          <>Everything from the Notion workspace is already here.</>
        ) : (
          <>
            Writes{" "}
            {plan.accounts.length > 0 && (
              <>
                <span style={{ color: T2 }}>
                  {plan.accounts.map((a) => a.name).join(" and ")}
                </span>{" "}
                to your accounts
              </>
            )}
            {plan.accounts.length > 0 && plan.trades.length > 0 && ", and "}
            {plan.trades.length > 0 && (
              <>
                the one real trade in the workspace —{" "}
                <span style={{ color: T2 }}>EUR/USD short, 27 Aug, closed by stop</span>
              </>
            )}
            . The 15 session phases are already loaded.
          </>
        )}
      </div>
      {/* Say plainly what is NOT coming, so its absence is not read as a bug. */}
      <div style={{ fontSize: 10, color: T3, lineHeight: 1.6, borderTop: `1px solid ${BD}`, paddingTop: 8 }}>
        The Trade Journal database itself held one row with every field empty, and the three
        review templates were blank — there is nothing in them to import. The ~20 archived
        FX REPLAY pages and the duplicate <span style={{ fontFamily: MONO }}>PRESS 'N' PLAY (1)</span>{" "}
        tree are left alone, as agreed.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={nothingToDo}
          onClick={() => {
            onSeed(plan);
            const bits = [];
            if (plan.accounts.length) bits.push(`${plan.accounts.length} account${plan.accounts.length === 1 ? "" : "s"}`);
            if (plan.trades.length) bits.push("1 trade");
            setDone(`Imported ${bits.join(" and ")}. Nothing existing was overwritten.`);
          }}
          style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 11.5, fontWeight: 600,
            fontFamily: "inherit", cursor: nothingToDo ? "default" : "pointer",
            background: nothingToDo ? "transparent" : AC2,
            color: nothingToDo ? T3 : "#000",
            border: `1px solid ${nothingToDo ? BD : AC2}`,
            opacity: nothingToDo ? 0.5 : 1,
          }}
        >
          Import
        </button>
        <button type="button" onClick={onDismiss}
          style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 11.5, fontFamily: "inherit",
            cursor: "pointer", background: "transparent", color: T2, border: `1px solid ${BD}`,
          }}>
          Not now
        </button>
      </div>
    </Card>
  );
}
