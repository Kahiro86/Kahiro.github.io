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

// Whole days from date-string a to b (positive when b is later). Anchored at
// noon so DST shifts can never round a day boundary the wrong way.
export const daysBetween = (a, b) =>
  Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

// Shift a YYYY-MM-DD string by n days (n may be negative) — unlike
// `daysAgoStr`, this is anchored on the given date string, not real "now",
// so it works correctly when viewing/backdating a day other than today.
export const shiftDateStr = (ds, n) => {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return localDateStr(dt);
};
