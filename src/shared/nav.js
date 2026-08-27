import { Layers, Target, Church, BarChart3, Trophy, Building2, CalendarDays, Dumbbell, CircleCheckBig, Utensils } from "lucide-react";

// ONE workspace, many lenses. The app used to fan out into seven separate
// top-level modules; it is now a single system ("Kaizen OS") you look at
// through facets. `Home` is the daily cockpit anchor; every other area is a
// lens on the same underlying data (habits, trades, finance, faith, time,
// progress) rather than a separate app.
//
// The ids below are unchanged so every deep-link, command-palette destination
// and `module:group` jump keeps working — only the framing collapsed. Each
// facet still carries its own internal group switcher (see the module's
// FooOS.jsx shell): "The Firm" = Trading + Wealth + HQ; "Life" = Habits +
// Nutrition + Journal + Purity; "Faith & Mind" = Faith + Mind.
export const NAV_SECTIONS = ["Home", "Facets"];

// Order is the argument. Nutrition sits directly after Home and before Body
// because eating is the thing decided most often in a day and it used to be
// buried two levels inside Body → Fuel. Today → Nutrition → Body reads as a
// sequence; the rest are lenses you open when you want them.
export const NAV = [
  { id: "dashboard", label: "Home",         icon: Layers,      section: "Home" },
  { id: "nutrition", label: "Nutrition",    icon: Utensils,    section: "Facets" },
  { id: "gym",       label: "Body",         icon: Dumbbell,    section: "Facets" },
  { id: "habits",    label: "Habits",       icon: CircleCheckBig, section: "Facets" },
  { id: "faith",     label: "Faith",        icon: Church,      section: "Facets" },
  { id: "firm",      label: "The Firm",     icon: Building2,   section: "Facets" },
  { id: "calendar",  label: "Calendar",     icon: CalendarDays, section: "Facets" },
  { id: "analytics", label: "The Record",   icon: BarChart3,   section: "Facets" },
];
