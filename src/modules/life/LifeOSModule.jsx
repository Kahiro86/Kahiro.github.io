// ── Life OS — Life + Athlete, one roof ────────────────────────────────
// Life OS (habits/routines/journal/purity) and Athlete OS (workouts/body/
// nutrition) are both "the daily life" pillar — this shell puts them under
// one nav entry. Both stay fully self-contained; this shell only decides
// which whole module is on screen. `navHint` (from App.jsx's compound
// "life:group" nav ids) lets a deep link — e.g. workout-pace — land on the
// Athlete group instead of always this shell's own default.
import { useEffect, useState } from "react";
import { Target, Dumbbell } from "lucide-react";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { LifeOSCore } from "./LifeOSCore.jsx";
import { AthleteOS } from "../athlete/AthleteOS.jsx";

const GROUPS = [
  { id: "life", l: "Life", i: Target },
  { id: "athlete", l: "Athlete", i: Dumbbell },
];

export function LifeOSModule({ habits, setHabits, loaded = true, onNavigate, xpInfo, navHint } = {}) {
  const [group, setGroup] = useState("life");

  useEffect(() => {
    if (navHint?.group) setGroup(navHint.group);
  }, [navHint?.nonce]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tint="rgba(6,6,6,0.75)" activeBg="rgba(255,255,255,0.1)" activeColor="#FFFFFF"
        pad="4px 10px" fontSize={11} gap={8}
        tabs={GROUPS} active={group} onSelect={setGroup} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {group === "life" && <LifeOSCore habits={habits} setHabits={setHabits} loaded={loaded} onNavigate={onNavigate} xpInfo={xpInfo} />}
        {group === "athlete" && <AthleteOS />}
      </div>
    </div>
  );
}
