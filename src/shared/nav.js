import { Layers, TrendingUp, Dumbbell, DollarSign, Target, Heart, BookOpen, Zap, Activity } from "lucide-react";

// Core modules are fully functional; `soon` modules are grouped and dimmed in
// the sidebar so the working product isn't diluted by placeholders.
export const NAV = [
  { id: "dashboard",    label: "Command Center", icon: Layers },
  { id: "trading",      label: "Trading OS",     icon: TrendingUp },
  { id: "athlete",      label: "Athlete OS",     icon: Dumbbell },
  { id: "finance",      label: "Finance OS",     icon: DollarSign },
  { id: "life",         label: "Life OS",        icon: Target },
  { id: "relations",    label: "Relationships",  icon: Heart,    soon: true },
  { id: "knowledge",    label: "Knowledge",      icon: BookOpen, soon: true },
  { id: "productivity", label: "Productivity",   icon: Zap,      soon: true },
  { id: "health",       label: "Health",         icon: Activity, soon: true },
];
