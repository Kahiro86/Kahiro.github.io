export const getDayName = () => new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase().slice(0, 3);
export const uidA = () => `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
