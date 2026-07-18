import { Layers, TrendingUp, Dumbbell, DollarSign, Target, Brain, Church, BarChart3, Trophy, Building2 } from "lucide-react";

// The app is organised around the firm's doctrine: one command bridge, the
// Machine (Stark — the external build), the Man (Batman — the internal build),
// and the mirror that reflects both. `section` drives the grouped sidebar;
// `soon` modules are dimmed until their build wave lands.
export const NAV_SECTIONS = ["Command", "The Machine", "The Man", "Insight"];

export const NAV = [
  { id: "dashboard", label: "Command Center", icon: Layers,      section: "Command" },
  { id: "firm",      label: "The Firm",       icon: Building2,   section: "The Machine" },
  { id: "trading",   label: "Trading OS",     icon: TrendingUp,  section: "The Machine" },
  { id: "finance",   label: "Finance OS",     icon: DollarSign,  section: "The Machine" },
  { id: "life",      label: "Life OS",        icon: Target,      section: "The Man" },
  { id: "athlete",   label: "Athlete OS",     icon: Dumbbell,    section: "The Man" },
  { id: "faith",     label: "Faith OS",       icon: Church,      section: "The Man" },
  { id: "mind",      label: "Mind OS",        icon: Brain,       section: "The Man" },
  { id: "journey",   label: "Journey",        icon: Trophy,      section: "Insight" },
  { id: "analytics", label: "Analytics",      icon: BarChart3,   section: "Insight" },
];
