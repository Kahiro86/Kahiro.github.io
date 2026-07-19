// ── Faith & Mind — Faith + Mind, one roof ─────────────────────────────
// Faith OS (the walk/scripture/devotional) and Mind OS (reading/notes/
// decisions) are both "the inner life" pillar — this shell puts them under
// one nav entry. Both stay fully self-contained; this shell only decides
// which whole module is on screen. `navHint` (from App.jsx's compound
// "faith:group" nav ids) lets a deep link — e.g. a decision review — land
// on the Mind group instead of always this shell's own default.
import { useEffect, useState } from "react";
import { Church, Brain } from "lucide-react";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { FaithCore } from "./FaithCore.jsx";
import { MindOS } from "../mind/MindOS.jsx";

const GROUPS = [
  { id: "faith", l: "Faith", i: Church },
  { id: "mind", l: "Mind", i: Brain },
];

export function FaithOS({ habits, setHabits, loaded = true, navHint } = {}) {
  const [group, setGroup] = useState("faith");

  useEffect(() => {
    if (navHint?.group) setGroup(navHint.group);
  }, [navHint?.nonce]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tint="rgba(6,6,6,0.75)" activeBg="rgba(255,255,255,0.1)" activeColor="#FFFFFF"
        pad="4px 10px" fontSize={11} gap={8}
        tabs={GROUPS} active={group} onSelect={setGroup} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {group === "faith" && <FaithCore habits={habits} setHabits={setHabits} loaded={loaded} />}
        {group === "mind" && <MindOS />}
      </div>
    </div>
  );
}
