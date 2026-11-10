import { describe, expect, it } from "vitest";
import { INSURER_FORMAT_FILE, parseDate, parseDueFile, stagePolicy } from "@/engine/live-run";
import { OUTCOMES, TICKETS, agg, blockOf, outcomeOf, reportingBlocks, reviewRows, ticketOf } from "@/components/r1/review-model";
import { persisted } from "@/components/r1/cohort-model";
import { BASE_POLICIES } from "@/data/persistency";

describe("insurer due-list format", () => {
  it("reads dates the way the insurer writes them", () => {
    expect(parseDate("16-Jan-27")).toBe("2027-01-16");
    expect(parseDate("1-Apr-2025")).toBe("2025-04-01");
    expect(parseDate("05/11/2026")).toBe("2026-11-05");
    expect(parseDate("2026-11-05")).toBe("2026-11-05");
    expect(parseDate("soon")).toBe("");
  });

  it("reads the policy admin export as it is", () => {
    const { rows, missing, problems } = parseDueFile(INSURER_FORMAT_FILE);
    expect(missing).toEqual([]);
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(3);
    const r = rows[1]!;
    expect(r).toMatchObject({ name: "Rakesh Gupta", premium: 28000, suspense: 6000, netCollectable: 22000, product: "Traditional", mode: "Annual" });
    expect(stagePolicy(r).reasons.some((x) => x.includes("suspense"))).toBe(true);
    expect(rows[0]!.product).toBe("ULIP");
    expect(rows[2]!.mode).toBe("Half-yearly");
  });
});

describe("monthly review", () => {
  const block = blockOf(BASE_POLICIES, 13, "All");
  const rows = reviewRows(BASE_POLICIES);

  it("channel rows add up to the grand total", () => {
    const top = rows.filter((r) => r.level === 0 && !r.total);
    const banca = rows.find((r) => r.key === "Bancassurance total")!;
    const sum = [...top, banca].reduce((a, r) => a + agg(block.filter(r.match), 13).premium, 0);
    expect(Math.round(sum)).toBe(Math.round(agg(block, 13).premium));
    const banks = rows.filter((r) => r.level === 1).reduce((a, r) => a + block.filter(r.match).length, 0);
    expect(banks).toBe(block.filter(banca.match).length);
  });

  it("ticket bands and calling outcomes cover the whole block", () => {
    expect(TICKETS.reduce((a, t) => a + block.filter((p) => ticketOf(p) === t).length, 0)).toBe(block.length);
    const unpaid = block.filter((p) => !persisted(p, 13));
    expect(OUTCOMES.reduce((a, o) => a + unpaid.filter((p) => outcomeOf(p) === o).length, 0)).toBe(unpaid.length);
  });

  it("reporting blocks match the 13th-month definition", () => {
    const b = reportingBlocks(1).find((x) => x.period === 13)!;
    expect(b.report).toMatch(/Oct 2026/);
    expect(b.from).toMatch(/Oct 2024/);
    expect(b.to).toMatch(/30 Sept? 2025/);
  });
});
