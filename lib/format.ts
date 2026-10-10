// Display helpers. All staff-facing times are India time, whatever the server's zone.
const TZ = "Asia/Kolkata";

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function fmtDate(isoDate: string | null | undefined) {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function minutesSince(iso: string, now = Date.now()) {
  return (now - Date.parse(iso)) / 60_000;
}

/** Value for <input type="datetime-local"> in IST. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(Date.parse(iso) + 330 * 60_000);
  return d.toISOString().slice(0, 16);
}

/** Parses a datetime-local value typed in IST back to an ISO instant. */
export function fromLocalInput(v: string | null | undefined) {
  if (!v) return null;
  const t = Date.parse(`${v}:00+05:30`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function fmtMins(m: number | null) {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)} min`;
  return `${(m / 60).toFixed(1)} h`;
}

export function pct(x: number | null) {
  return x == null ? "—" : `${Math.round(x * 100)}%`;
}
