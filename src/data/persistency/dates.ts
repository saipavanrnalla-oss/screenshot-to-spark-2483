// All dates are handled in UTC so server and browser render the same text.
// 28 Oct 2026, 10:30 IST.
export const NOW = new Date(Date.UTC(2026, 9, 28, 5, 0, 0));
export const NOW_ISO = "2026-10-28";
export const DAY_MS = 86_400_000;

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function fromIso(s: string): Date {
  return new Date(s.length === 10 ? `${s}T00:00:00Z` : s);
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}
export function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target;
}
export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}
export function monthsBetween(from: Date, to: Date): number {
  let m = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) m -= 1;
  return m;
}
