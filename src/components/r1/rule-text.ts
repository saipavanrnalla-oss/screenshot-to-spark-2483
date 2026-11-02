import { DIMENSION_LABEL, type ConditionRow, type DimensionKey, type Rule } from "@/data/persistency";
import { inr } from "@/lib/format";

export function rowText(r: ConditionRow): string {
  const dim = DIMENSION_LABEL[r.dim] ?? r.dim;
  const money = r.dim === "ticketBand";
  const n = (x: number | undefined) => (x === undefined ? "?" : money ? inr(x) : String(x));
  switch (r.op) {
    case "is":
      return `${dim} is ${r.values.join(", ") || "any"}`;
    case "is any of":
      return `${dim} is any of ${r.values.join(", ") || "any"}`;
    case "is not":
      return `${dim} is not ${r.values.join(", ")}`;
    case "above":
      return `${dim} above ${n(r.n)}`;
    case "below":
      return `${dim} below ${n(r.n)}`;
    case "between":
      return `${dim} between ${n(r.n)} and ${n(r.n2)}`;
    case "within N days of":
      return `Within ${r.n ?? "?"} days of ${r.values[0] ?? "due date"}`;
  }
}

/** Rule conditions as one sentence. */
export function ruleConditionText(rule: Rule): string {
  const parts = (Object.entries(rule.when) as [DimensionKey, string[]][])
    .filter(([, v]) => v && v.length)
    .map(([k, v]) => `${DIMENSION_LABEL[k]} is ${v.join(", ")}`);
  const groups = (rule.conds ?? []).map((g) => g.map(rowText).join(" and "));
  const base = parts.join(" and ");
  if (!groups.length) return base || "No conditions";
  const ors = groups.length > 1 ? `(${groups.join(") or (")})` : groups[0]!;
  return base ? `${base} and ${ors}` : ors;
}

/** The when-map turned into editor rows, for editing seeded rules. */
export function toRows(rule: Rule): ConditionRow[][] {
  const base: ConditionRow[] = (Object.entries(rule.when) as [DimensionKey, string[]][])
    .filter(([, v]) => v && v.length)
    .map(([dim, values]) => ({ dim, op: values.length > 1 ? "is any of" : "is", values }));
  const groups = rule.conds?.length ? rule.conds : [[]];
  return groups.map((g) => [...base, ...g]);
}
