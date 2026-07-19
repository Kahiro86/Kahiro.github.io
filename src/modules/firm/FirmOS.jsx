// ── The Firm — the doctrine module ───────────────────────────────────
// "The One-Man Trading Firm" as an operating surface: the Fleet (accounts,
// real and locked), the Vault (the one-way MMF door + the Fleet Formula that
// splits every withdrawal), the Gate (the scaling proof that unlocks account
// #2), and the Covenant (the Ten Laws, signed to yourself). Every number is
// real where the data exists and honestly empty where it doesn't — nothing
// here is mocked. Phase 1: single funded account, locked fleet slots.
import { useState } from "react";
import { Building2, TrendingUp, Vault, Target, ScrollText, Map } from "lucide-react";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { Hydrating } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";
import { FleetTab } from "./FleetTab.jsx";
import { VaultTab } from "./VaultTab.jsx";
import { GateTab } from "./GateTab.jsx";
import { CampaignTab } from "./CampaignTab.jsx";
import { CovenantTab } from "./CovenantTab.jsx";

const FI = "#E5484D"; // crimson accent (monochrome theme)

export function FirmOS() {
  const [tab, setTab] = useState("fleet");
  const [trades, , tradesLoaded] = useStorageState("ict_trades", []);
  const [rawBal] = useStorageState("ict_balance", 15000);
  const [finance] = useStorageState("finance_state", DEFAULT_FINANCE_STATE);
  const [reviews] = useStorageState("ict_reviews", []);
  const [withdrawals, setWithdrawals, wdLoaded] = useStorageState("firm_withdrawals", []);
  const [config, setConfig, cfgLoaded] = useStorageState("firm_config", null);
  const [covenant, setCovenant, covLoaded] = useStorageState("firm_covenant", null);
  const [campaign, setCampaign, campLoaded] = useStorageState("firm_campaign", null);

  const loaded = tradesLoaded && wdLoaded && cfgLoaded && covLoaded && campLoaded;
  if (!loaded) return <Hydrating label="Opening the firm…" />;

  const shared = { trades, rawBal, finance, reviews, withdrawals, setWithdrawals, config, setConfig };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tint="rgba(10,10,10,0.6)" activeBg={`${FI}26`} activeColor="#FFFFFF"
        tabs={[
          { id: "fleet", l: "Fleet", i: TrendingUp },
          { id: "vault", l: "Vault", i: Vault },
          { id: "gate", l: "Gate", i: Target },
          { id: "campaign", l: "Campaign", i: Map },
          { id: "covenant", l: "Covenant", i: ScrollText },
        ]}
        active={tab} onSelect={setTab}
        left={<Building2 size={16} color={FI} style={{ marginRight: 2 }} />} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "fleet" && <FleetTab {...shared} />}
        {tab === "vault" && <VaultTab {...shared} />}
        {tab === "gate" && <GateTab {...shared} />}
        {tab === "campaign" && <CampaignTab trades={trades} reviews={reviews} withdrawals={withdrawals} campaign={campaign} setCampaign={setCampaign} />}
        {tab === "covenant" && <CovenantTab covenant={covenant} setCovenant={setCovenant} />}
      </div>
    </div>
  );
}
