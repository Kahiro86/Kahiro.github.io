// Local-timezone date strings. The app's users live in Nairobi (UTC+3), so
// "today" must come from local time — toISOString() is UTC and would put
// anything logged between midnight and 3AM on the previous day.
export const localDateStr = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const daysAgoStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
};
