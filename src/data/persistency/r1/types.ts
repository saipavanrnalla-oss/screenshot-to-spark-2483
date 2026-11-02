import type { RoleId } from "@/config/users";

/** Shared lifecycle for rules, workflows, agents and stage settings. */
export type VersionStatus = "Draft" | "In review" | "Active" | "Retired";

export interface SimRun {
  id: string;
  at: string;
  by: string;
  policyId: string;
  scenario: string;
  result: "Pass" | "Fail";
  reason?: string | undefined;
  steps: number;
}

export interface Version<T> {
  no: number;
  status: VersionStatus;
  author: string;
  at: string;
  note: string;
  approver?: string | undefined;
  approvedAt?: string | undefined;
  returnReason?: string | undefined;
  effectiveFrom?: string | undefined;
  data: T;
  sims?: SimRun[] | undefined;
  /** Agents: calls reviewed since this version went Active. */
  reviewedCalls?: number | undefined;
  /** Notes attached from task reviews. */
  reviewNotes?: string[] | undefined;
}

export type ApprovalKind = "rule" | "workflow" | "agent" | "stage" | "executor" | "experiment";

export interface Signoff {
  role: RoleId;
  name: string;
  at: string;
}

export interface Approval {
  id: string;
  kind: ApprovalKind;
  objectId: string;
  objectName: string;
  versionNo?: number | undefined;
  requestedBy: string;
  at: string;
  summary: string;
  reach: number;
  diff: string[];
  conflicts: string[];
  sim?: { result: "Pass" | "Fail"; reason?: string | undefined; steps: number } | undefined;
  /** Roles that must each sign off. */
  needs: RoleId[];
  signoffs: Signoff[];
  status: "waiting" | "approved" | "returned";
  decidedBy?: string | undefined;
  decidedAt?: string | undefined;
  reason?: string | undefined;
  effectiveFrom?: string | undefined;
  /** Why a second approver is needed, when one is. */
  secondApproverReason?: string | undefined;
  payload?: unknown;
}

export type ExecutorKind = "agent" | "vendor" | "person" | "system";

export interface ActivityRow {
  id: string;
  policyId: string;
  at: string;
  step: string;
  executor: string;
  executorKind: ExecutorKind;
  version?: string | undefined;
  result: string;
  ruleId?: string | undefined;
  workflow?: string | undefined;
  channel?: "WhatsApp" | "Voice" | "SMS" | "Payment" | "File" | "System" | "Visit" | undefined;
  disposition?: string | undefined;
  reason?: string | undefined;
  durationSec?: number | undefined;
  language?: string | undefined;
  transcriptId?: string | undefined;
  threadId?: string | undefined;
  scriptVersion?: string | undefined;
  offers?: string[] | undefined;
  matched?: Record<string, string> | undefined;
  checks?: string[] | undefined;
  test?: boolean | undefined;
  linkedTo?: string | undefined;
  taskId?: string | undefined;
}
