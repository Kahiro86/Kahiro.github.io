import { Layers, TrendingUp, Dumbbell, DollarSign, Target, Brain, Church, BarChart3, Trophy, Building2 } from "lucide-react";

// Core modules are fully functional; `soon` modules are grouped and dimmed in
// the sidebar until their build wave lands.
export const NAV = [
  { id: "dashboard", label: "Command Center", icon: Layers },
  { id: "firm",      label: "The Firm",       icon: Building2 },
  { id: "life",      label: "Life OS",        icon: Target },
  { id: "trading",   label: "Trading OS",     icon: TrendingUp },
  { id: "athlete",   label: "Athlete OS",     icon: Dumbbell },
  { id: "finance",   label: "Finance OS",     icon: DollarSign },
  { id: "mind",      label: "Mind OS",        icon: Brain },
  { id: "faith",     label: "Faith OS",       icon: Church },
  { id: "journey",   label: "Journey",        icon: Trophy },
  { id: "analytics", label: "Analytics",      icon: BarChart3 },
];
