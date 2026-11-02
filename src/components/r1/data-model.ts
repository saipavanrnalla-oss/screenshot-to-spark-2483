import { useMemo } from "react";
import { BASE_POLICIES, POLICY_INDEX, type Policy } from "@/data/persistency";
import { ADAPTERS, PAYMENT_RECEIPTS, STAGE_CHANGE_IDS, newDueDate, seedHistory, type AdapterDef, type CheckResult, type FileReceipt } from "@/data/persistency/r1/files";
import type { Permission } from "@/config/users";
import { usePersistencyStore } from "@/store/persistency";
import { useWork } from "@/store/work";

export function importPermission(a: AdapterDef): Permission | null {
  if (a.direction === "Out") return null;
  return a.importKind === "payments" ? "files.importPayments" : "files.import";
}

/** Seeded receipts plus imports made this session, newest first. */
export function useFileHistory(adapterId: string): FileReceipt[] {
  const added = useWork((s) => s.fileHistory[adapterId]);
  const notes = useWork((s) => s.fileNotes);
  return useMemo(() => [...(added ?? []), ...seedHistory(adapterId)].map((r) => ({ ...r, notes: [...r.notes, ...(notes[r.id] ?? [])] })), [added, adapterId, notes]);
}

export function useAdapterRows() {
  const hist = useWork((s) => s.fileHistory);
  const imported = useWork((s) => s.imported);
  return useMemo(
    () =>
      ADAPTERS.map((a) => {
        const last = hist[a.id]?.[0];
        return {
          ...a,
          lastReceived: last?.at ?? a.lastReceived,
          rows: last?.rows ?? a.rows,
          rejects: last?.rejects ?? a.rejects,
          overdue: a.overdue && !imported[a.id],
        };
      }),
    [hist, imported],
  );
}

const STAGE_SET = new Set(STAGE_CHANGE_IDS);
const OPEN = new Set(["Renewal window open", "Grace", "Promised"]);

export interface ImportSummary {
  lines: [string, number][];
}

/** What a confirmed import will change, computed from the checked rows. */
export function summarise(adapterId: string, check: CheckResult): ImportSummary {
  const v = check.valid;
  if (adapterId === "due-list") {
    const known = v.filter((r) => POLICY_INDEX.has(r["policy"] ?? ""));
    return {
      lines: [
        ["New policies", v.length - known.length],
        ["Updated policies", known.length],
        ["Policies changing stage", known.filter((r) => STAGE_SET.has(r["policy"] ?? "")).length],
      ],
    };
  }
  if (adapterId === "payments") {
    const matched = v.filter((r) => {
      const p = BASE_POLICIES[POLICY_INDEX.get(r["policy"] ?? "") ?? -1];
      return p && OPEN.has(p.state);
    });
    const ids = new Set(matched.map((r) => r["receipt"]));
    return {
      lines: [
        ["Receipts", v.length],
        ["Matched to a policy", matched.length],
        ["Unmatched", v.length - matched.length],
        ["Open touches that close", PAYMENT_RECEIPTS.filter((r) => r.closedTouch && ids.has(r["receipt"])).length],
      ],
    };
  }
  if (adapterId === "bounce") return { lines: [["Bounces", v.length], ["Policies moving to bounce recovery (R4)", v.filter((r) => POLICY_INDEX.has(r["policy"] ?? "")).length]] };
  if (adapterId === "call-results") return { lines: [["Call results", v.length], ["Activity rows written", v.filter((r) => POLICY_INDEX.has(r["policy"] ?? "")).length]] };
  if (adapterId === "wa-results") return { lines: [["Message results", v.length]] };
  if (adapterId === "cohort") return { lines: [["Cohort rows", v.length]] };
  return { lines: [["Rows", v.length]] };
}

/** Applies a confirmed import to the saved work. */
export function applyImport(adapterId: string, check: CheckResult, by: string, rejects: number) {
  const ps = usePersistencyStore.getState();
  const ws = useWork.getState();
  const v = check.valid;
  if (adapterId === "due-list") {
    ps.setImportedNew(true);
    const patches: Record<string, Partial<Policy>> = {};
    for (const r of v) {
      const id = r["policy"] ?? "";
      if (!STAGE_SET.has(id)) continue;
      const p = BASE_POLICIES[POLICY_INDEX.get(id)!]!;
      patches[id] = { dueDate: newDueDate(p), lifecycleStage: "Renewal window", state: "Renewal window open" };
    }
    ps.patchPolicies(patches);
  }
  if (adapterId === "payments") {
    const ids = v.map((r) => r["policy"] ?? "").filter((id) => {
      const p = BASE_POLICIES[POLICY_INDEX.get(id) ?? -1];
      return p && OPEN.has(p.state);
    });
    ps.markPaid(ids);
  }
  if (adapterId === "bounce") {
    const patches: Record<string, Partial<Policy>> = {};
    for (const r of v) if (POLICY_INDEX.has(r["policy"] ?? "")) patches[r["policy"]!] = { reasonCode: "Mandate bounce" };
    ps.patchPolicies(patches);
  }
  if (adapterId === "call-results") {
    ws.addActivities(
      v
        .filter((r) => POLICY_INDEX.has(r["policy"] ?? ""))
        .map((r) => ({ policyId: r["policy"]!, step: "Collection call", executor: r["vendor"] ?? "Call-centre vendor", executorKind: "vendor" as const, result: r["disposition"] ?? "", disposition: r["disposition"], durationSec: Number(r["duration"]) || undefined, channel: "Voice" as const, workflow: "R2", reason: "From the vendor's results file" })),
    );
  }
  ws.setImported(adapterId);
  ws.recordImport(adapterId, { rows: v.length + rejects, rejects, by });
  ws.log(by, `Imported ${adapterId}: ${v.length} valid, ${rejects} rejects`);
}
