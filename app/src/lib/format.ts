export function displayDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "3 hours ago", "yesterday"; the date past a month. */
export function ago(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return relative.format(-Math.round(seconds / MINUTE), "minute");
  if (seconds < DAY) return relative.format(-Math.round(seconds / HOUR), "hour");
  if (seconds < 30 * DAY) return relative.format(-Math.round(seconds / DAY), "day");
  return displayDateTime(iso).slice(0, 10);
}
