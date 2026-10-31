const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Indian digit grouping: 1,24,500 and 1,24,50,000. */
export function groupIndian(n: number): string {
  const neg = n < 0;
  const s = Math.round(Math.abs(n)).toString();
  let out: string;
  if (s.length <= 3) out = s;
  else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    out = `${rest},${last3}`;
  }
  return neg ? `-${out}` : out;
}

export function inr(n: number): string {
  return `₹${groupIndian(n)}`;
}

export function crore(n: number, digits = 1): string {
  return `₹${(n / 1e7).toFixed(digits)} Cr`;
}

export function croreValue(cr: number, digits = 1): string {
  return `₹${cr.toFixed(digits)} Cr`;
}

export function lakh(n: number, digits = 1): string {
  return `₹${(n / 1e5).toFixed(digits)} L`;
}

/** Money compact: lakh under a crore, crore above. */
export function money(n: number): string {
  return Math.abs(n) >= 1e7 ? crore(n) : Math.abs(n) >= 1e5 ? lakh(n) : inr(n);
}

export function num(n: number): string {
  return groupIndian(n);
}

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** 31 Oct 2026 */
export function date(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input.length === 10 ? `${input}T00:00:00Z` : input) : input;
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** 10:30:12, shown in IST for the demo clock. */
export function time(input: string | Date, withSeconds = true): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const ist = new Date(d.getTime() + 5.5 * 3_600_000);
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  const ss = String(ist.getUTCSeconds()).padStart(2, "0");
  return withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

export function dateTime(input: string | Date): string {
  return `${date(input)}, ${time(input, false)}`;
}
