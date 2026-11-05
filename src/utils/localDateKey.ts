// Local-date (device timezone) YYYY-MM-DD — NOT toISOString(), which is UTC
// and misreports "today" during the UTC+7 morning window (00:00–07:00 local
// falls on the previous UTC calendar day).
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
