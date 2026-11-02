import { describe, expect, it } from "vitest";
import { BOUNCE_ROWS, CALL_RESULT_ROWS, PAYMENT_RECEIPTS, STAGE_CHANGE_IDS, autoMap, checkFile, dueListSample, missingColumns, waResultsSample } from "@/data/persistency/r1/files";
import { EXECUTORS, canReplaceInSlice, shareNeedsApproval } from "@/data/persistency/r1/executors";

describe("release 1 sample files", () => {
  it("due list has 12,000 rows; with PREM_FREQ mapped and dd/mm/yyyy it gives 11,968 valid and 32 rejects", () => {
    const f = dueListSample();
    expect(f.rows.length).toBe(12_000);
    const auto = autoMap("due-list", f.header);
    expect(auto["PREM_FREQ"]).toBeUndefined();
    const r = checkFile("due-list", f, { ...auto, PREM_FREQ: "mode" }, "dd/mm/yyyy");
    expect(r.valid.length).toBe(11_968);
    expect(r.rejects.length).toBe(32);
  });

  it("a mapping without every required field is refused", () => {
    const f = dueListSample();
    const r = checkFile("due-list", f, autoMap("due-list", f.header), "dd/mm/yyyy");
    expect(r.missingRequired).toContain("Payment mode");
  });

  it("a file with the wrong header is refused with the missing columns", () => {
    expect(missingColumns("payments", ["RECEIPT_NO", "AMOUNT"])).toEqual(["POLICY_NO", "PAID_ON", "MODE"]);
  });

  it("61 policies change stage", () => {
    expect(STAGE_CHANGE_IDS.length).toBe(61);
  });

  it("payment file: 486 receipts, 15 unmatched, 38 with open touches", () => {
    expect(PAYMENT_RECEIPTS.length).toBe(486);
    expect(PAYMENT_RECEIPTS.filter((r) => r.policyId.startsWith("SLI09")).length).toBe(15);
    expect(PAYMENT_RECEIPTS.filter((r) => r.closedTouch).length).toBe(38);
  });

  it("bounce, call and WhatsApp samples have 90, 800 and 4,500 rows", () => {
    expect(BOUNCE_ROWS.length).toBe(90);
    expect(CALL_RESULT_ROWS.length).toBe(800);
    expect(waResultsSample().rows.length).toBe(4_500);
  });
});

describe("executors", () => {
  it("eleven executors; Replace in slice only for the voice and WhatsApp message agents", () => {
    expect(EXECUTORS.length).toBe(11);
    expect(EXECUTORS.filter(canReplaceInSlice).map((e) => e.id).sort()).toEqual(["message", "renewal-voice"]);
  });

  it("a share change above 20 points needs approval", () => {
    expect(shareNeedsApproval(10, 30)).toBe(false);
    expect(shareNeedsApproval(10, 31)).toBe(true);
  });
});
