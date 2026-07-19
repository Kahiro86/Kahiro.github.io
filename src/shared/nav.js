import { Layers, Target, Church, BarChart3, Trophy, Building2 } from "lucide-react";

// The app is organised around the firm's doctrine: one command bridge, the
// Machine (Stark — the external build), the Man (Batman — the internal build),
// and the mirror that reflects both. `section` drives the grouped sidebar;
// `soon` modules are dimmed until their build wave lands.
//
// "The Firm" carries Trading + Finance underneath (Fleet/Wealth/Doctrine
// groups); "Life OS" carries Athlete; "Faith & Mind" carries Mind — each
// merged module has its own internal group switcher (see the module's
// FooOS.jsx outer shell) rather than its own separate nav entry.
export const NAV_SECTIONS = ["Command", "The Machine", "The Man", "Insight"];

export const NAV = [
  { id: "dashboard", label: "Command Center", icon: Layers,      section: "Command" },
  { id: "firm",      label: "The Firm",       icon: Building2,   section: "The Machine" },
  { id: "life",      label: "Life OS",        icon: Target,      section: "The Man" },
  { id: "faith",     label: "Faith & Mind",   icon: Church,      section: "The Man" },
  { id: "journey",   label: "Journey",        icon: Trophy,      section: "Insight" },
  { id: "analytics", label: "Analytics",      icon: BarChart3,   section: "Insight" },
];
