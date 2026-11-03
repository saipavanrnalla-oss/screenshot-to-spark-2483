import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useMemo } from "react";
import { NOW, POLICY_INDEX, BASE_POLICIES, type Policy, type Rule } from "@/data/persistency";
import type { RoleId } from "@/config/users";
import type { ActivityRow, Approval, ApprovalKind, SimRun, Version } from "@/data/persistency/r1/types";
import type { HoldReason } from "@/data/persistency/r1/common";
import { seedAgentVersions } from "@/data/persistency/r1/agents";
import { seedWorkflowVersions } from "@/data/persistency/r1/wf";
import { seedStageVersions, type StageSettings } from "@/data/persistency/r1/stage-settings";
import { EXECUTORS, type Executor } from "@/data/persistency/r1/executors";
import { DEFAULT_HANDOFF_RULES, QUEUE, type AgentTask, type HandoffRule, type QueueTask } from "@/data/persistency/r1/tasks";
import { SEED_EXPERIMENTS, type Experiment } from "@/data/persistency/r1/reports";
import type { FileReceipt } from "@/data/persistency/r1/files";
import { usePersistencyStore } from "./persistency";

export interface SavedView {
  id: string;
  page: string;
  name: string;
  filters: Record<string, string>;
}

export interface Hold {
  reason: HoldReason;
  note: string;
  at: string;
  by: string;
  prevState: Policy["state"];
}

export interface OutboundList {
  id: string;
  kind: "Vendor work list" | "Visit list";
  to: string;
  workflow: string;
  date: string;
  policyIds: string[];
  removedPaid: number;
  removedChecks: number;
  createdBy: string;
  at: string;
  sent: boolean;
  source?: string | undefined;
}

export interface WorkEvent {
  id: number;
  at: string;
  by: string;
  text: string;
}

export interface Orchestration {
  oneJourney: boolean;
  precedence: string;
  countVendorTouches: boolean;
  noDuplicateTasks: boolean;
  deadlines: { call: number; message: number; person: number; file: number };
  retryGapHours: number;
  onTimeout: "Retry" | "Move to another executor" | "Send to team lead";
}

export interface ProposalState {
  status: "Sent to rules" | "Rejected";
  reason?: string | undefined;
  ruleId?: string | undefined;
  at: string;
  by: string;
}

interface WorkState {
  clock: number;
  activity: Record<string, ActivityRow[]>;
  holds: Record<string, Hold>;
  owners: Record<string, string>;
  savedViews: SavedView[];
  versions: Record<string, Version<unknown>[]>;
  approvals: Approval[];
  agentPause: Record<string, { at: string; by: string; reason: string }>;
  events: WorkEvent[];
  queue: Record<string, Partial<QueueTask> & { closed?: string | undefined }>;
  extraQueue: QueueTask[];
  handoffRules: HandoffRule[];
  testNumbers: string[];
  testTasks: AgentTask[];
  executors: Executor[];
  execHistory: { id: string; at: string; by: string; change: string }[];
  fileHistory: Record<string, FileReceipt[]>;
  fileNotes: Record<string, string[]>;
  mappings: Record<string, { version: number; mapping: Record<string, string>; dateFormat: string }>;
  imported: Record<string, boolean>;
  matched: Record<string, string>;
  outboundLists: OutboundList[];
  experiments: Experiment[];
  proposals: Record<string, ProposalState>;
  orchestration: Orchestration;
  newWorkflows: { code: string; name: string; stage: string; createdBy: string; archived?: boolean | undefined }[];
  archived: string[];
  wfNames: Record<string, string>;
  bannerSeen: Record<string, boolean>;

  stamp: () => string;
  addActivity: (row: Omit<ActivityRow, "id" | "at"> & { at?: string | undefined }) => void;
  addActivities: (rows: (Omit<ActivityRow, "id" | "at"> & { at?: string | undefined })[]) => void;
  placeHold: (policyId: string, reason: HoldReason, note: string, by: string) => number;
  releaseHold: (policyId: string, reason: string, by: string) => void;
  assignOwner: (ids: string[], owner: string, by: string) => void;
  sendPaymentLink: (policyId: string, by: string) => void;
  saveView: (v: Omit<SavedView, "id">) => void;
  deleteView: (id: string) => void;

  saveDraft: <T>(key: string, data: T, author: string, note?: string) => number;
  discardDraft: (key: string) => void;
  restoreVersion: (key: string, no: number, author: string) => number;
  attachSim: (key: string, run: SimRun) => void;
  addReviewNote: (key: string, note: string) => void;
  submit: (a: Omit<Approval, "id" | "at" | "status" | "signoffs">) => string;
  approve: (id: string, role: RoleId, name: string, effectiveFrom?: string) => "approved" | "signed" | "none";
  returnApproval: (id: string, name: string, reason: string) => void;

  pauseAgent: (id: string, by: string, reason: string) => void;
  resumeAgent: (id: string, by: string) => void;
  setPauseAll: (on: boolean, by: string, reason: string) => void;
  addTestNumber: (n: string) => void;
  sendTest: (task: AgentTask) => void;

  retryTask: (qid: string, by: string) => void;
  moveTask: (qid: string, to: string, by: string) => void;
  sendToLead: (qid: string, by: string) => void;
  setHandoffRules: (rules: HandoffRule[], by: string) => void;
  setOrchestration: (o: Orchestration, by: string) => void;

  updateExecutor: (id: string, patch: Partial<Executor>, by: string, change: string) => void;

  recordImport: (adapterId: string, r: Omit<FileReceipt, "id" | "at" | "notes">) => void;
  addFileNote: (adapterId: string, receiptId: string, note: string, by: string) => void;
  saveMapping: (adapterId: string, mapping: Record<string, string>, dateFormat: string) => void;
  setImported: (key: string) => void;
  matchReceipt: (receipt: string, policyId: string, by: string) => void;
  createList: (l: Omit<OutboundList, "id" | "at" | "sent">) => string;
  markListSent: (id: string) => void;

  saveExperiment: (e: Experiment) => void;
  decideProposal: (id: string, s: Omit<ProposalState, "at">) => void;
  createWorkflow: (name: string, stage: string, by: string) => string;
  archiveWorkflow: (code: string) => void;
  renameWorkflow: (code: string, name: string) => void;
  log: (by: string, text: string) => void;
  reset: () => void;
}

let eventSeq = 1;

function initial() {
  return {
    clock: 0,
    activity: {} as Record<string, ActivityRow[]>,
    holds: {} as Record<string, Hold>,
    owners: {} as Record<string, string>,
    savedViews: [] as SavedView[],
    versions: {} as Record<string, Version<unknown>[]>,
    approvals: seedApprovals(),
    agentPause: {} as Record<string, { at: string; by: string; reason: string }>,
    events: [] as WorkEvent[],
    queue: {} as Record<string, Partial<QueueTask> & { closed?: string | undefined }>,
    extraQueue: [] as QueueTask[],
    handoffRules: DEFAULT_HANDOFF_RULES,
    testNumbers: ["+91 98200 00001", "+91 98200 00002"],
    testTasks: [] as AgentTask[],
    executors: EXECUTORS,
    execHistory: [
      { id: "cc-fixed", at: "2026-09-30T06:00:00.000Z", by: "Head of Persistency", change: "R2 share 60 to 50" },
      { id: "renewal-voice", at: "2026-09-30T06:00:00.000Z", by: "Head of Persistency", change: "R2 Replace in slice at 15" },
    ],
    fileHistory: {} as Record<string, FileReceipt[]>,
    fileNotes: {} as Record<string, string[]>,
    mappings: {} as Record<string, { version: number; mapping: Record<string, string>; dateFormat: string }>,
    imported: {} as Record<string, boolean>,
    matched: {} as Record<string, string>,
    outboundLists: [] as OutboundList[],
    experiments: SEED_EXPERIMENTS,
    proposals: {} as Record<string, ProposalState>,
    orchestration: {
      oneJourney: true,
      precedence: "The journey with the more specific rule wins; on a tie, the earlier start.",
      countVendorTouches: true,
      noDuplicateTasks: true,
      deadlines: { call: 48, message: 24, person: 72, file: 24 },
      retryGapHours: 24,
      onTimeout: "Move to another executor",
    } as Orchestration,
    newWorkflows: [] as { code: string; name: string; stage: string; createdBy: string; archived?: boolean | undefined }[],
    archived: [] as string[],
    wfNames: {} as Record<string, string>,
    bannerSeen: {} as Record<string, boolean>,
  };
}

function seedApprovals(): Approval[] {
  return [
    {
      id: "AP-201", kind: "rule", objectId: "R15", objectName: "Early risk call", versionNo: 1, requestedBy: "MIS and analytics", at: "2026-10-27T09:10:00.000Z",
      summary: "New rule: Lowest propensity cohort within 90 days of due gets an early renewal call", reach: 0, diff: ["New rule", "When: cohort Lowest propensity, within 90 days of due date", "Then: Early renewal call by Premium Renewal Voice Agent", "Priority 24"], conflicts: [],
      needs: ["head"], signoffs: [], status: "waiting",
    },
    {
      id: "AP-202", kind: "rule", objectId: "R09", objectName: "Bank balance check", versionNo: 1, requestedBy: "MIS and analytics", at: "2026-10-26T11:40:00.000Z",
      summary: "New rule: bank partner, auto-debit, balance check 5 days before the debit", reach: 0, diff: ["New rule", "When: channel Bancassurance, payment method mandate or UPI autopay, within 5 days of due date", "Then: Send account balance request by Renewal Reminder Agent", "Priority 22"], conflicts: [],
      needs: ["head"], signoffs: [], status: "waiting",
    },
    {
      id: "AP-203", kind: "rule", objectId: "R16", objectName: "Month-end push", versionNo: 2, requestedBy: "Head of Persistency", at: "2026-10-25T07:20:00.000Z",
      summary: "Month-end push also covers cohort Low propensity", reach: 0, diff: ["Cohort: Moderate propensity → Moderate propensity, Low propensity", "Priority 25 → 24"], conflicts: [],
      needs: ["head"], signoffs: [], status: "waiting",
      payload: { cohort: ["Moderate propensity", "Low propensity", "Medium", "Band 3"], priority: 24 },
    },
    {
      id: "AP-204", kind: "agent", objectId: "message", objectName: "Renewal Reminder Agent", versionNo: 7, requestedBy: "MIS and analytics", at: "2026-10-27T13:05:00.000Z",
      summary: "Grace reminder template shortened; Tamil template added", reach: 0, diff: ["Template 'Grace reminder' text shortened", "Language added: Tamil template"], conflicts: [],
      needs: ["head"], signoffs: [{ role: "head", name: "Head of Persistency", at: "2026-10-27T15:00:00.000Z" }], status: "waiting",
    },
  ];
}

export const WORK_KEY = "pct-work-v1";

export const useWork = create<WorkState>()(
  persist(
    (set, get) => {
      const tick = (): string => {
        const c = get().clock + 1;
        set({ clock: c });
        return new Date(NOW.getTime() + c * 60_000).toISOString();
      };
      const event = (by: string, text: string) => set((s) => ({ events: [{ id: eventSeq++, at: tick(), by, text }, ...s.events].slice(0, 400) }));
      const pushRow = (row: ActivityRow) => set((s) => ({ activity: { ...s.activity, [row.policyId]: [row, ...(s.activity[row.policyId] ?? [])] } }));
      const versionsOf = (key: string): Version<unknown>[] => get().versions[key] ?? (seedVersions(key) as Version<unknown>[]);
      const putVersions = (key: string, list: Version<unknown>[]) => set((s) => ({ versions: { ...s.versions, [key]: list } }));

      return {
        ...initial(),
        stamp: tick,

        addActivity: (row) => {
          const at = row.at ?? tick();
          pushRow({ ...row, at, id: `U-${row.policyId}-${at}-${eventSeq++}` });
        },

        addActivities: (rows) => {
          const at = tick();
          set((s) => {
            const activity = { ...s.activity };
            for (const r of rows) {
              const row: ActivityRow = { ...r, at: r.at ?? at, id: `U-${r.policyId}-${at}-${eventSeq++}` };
              activity[r.policyId] = [row, ...(activity[r.policyId] ?? [])];
            }
            return { activity };
          });
        },

        placeHold: (policyId, reason, note, by) => {
          const ps = usePersistencyStore.getState();
          const base = ps.overrides[policyId]?.state ?? BASE_POLICIES[POLICY_INDEX.get(policyId) ?? -1]?.state ?? "Renewal window open";
          const state: Policy["state"] = reason === "Complaint" ? "Complaint-hold" : reason === "Bereavement" ? "Bereavement-hold" : "Do-not-contact";
          ps.patchPolicy(policyId, { state });
          const at = tick();
          set((s) => ({ holds: { ...s.holds, [policyId]: { reason, note, at, by, prevState: base } } }));
          const open = [...QUEUE, ...get().extraQueue].filter((q) => q.policyId === policyId && !get().queue[q.id]?.closed);
          const closed: Record<string, Partial<QueueTask> & { closed?: string }> = {};
          for (const q of open) closed[q.id] = { ...get().queue[q.id], closed: `Cancelled: on hold (${reason.toLowerCase()})` };
          set((s) => ({ queue: { ...s.queue, ...closed } }));
          pushRow({ id: `U-${policyId}-${at}-h`, policyId, at, step: "Placed on hold", executor: by, executorKind: "person", result: `On hold: ${reason}`, reason: note || reason, channel: "System" });
          open.forEach((q, i) =>
            pushRow({ id: `U-${policyId}-${at}-c${i}`, policyId, at, step: `Task cancelled: ${q.task}`, executor: q.executor, executorKind: "system", result: "Cancelled", reason: `On hold: ${reason}`, workflow: q.workflow, channel: "System" }),
          );
          event(by, `${policyId} placed on hold (${reason})`);
          return open.length;
        },

        releaseHold: (policyId, reason, by) => {
          const h = get().holds[policyId];
          usePersistencyStore.getState().patchPolicy(policyId, { state: h?.prevState ?? "Renewal window open" });
          const at = tick();
          set((s) => {
            const holds = { ...s.holds };
            delete holds[policyId];
            return { holds };
          });
          pushRow({ id: `U-${policyId}-${at}-r`, policyId, at, step: "Hold released", executor: by, executorKind: "person", result: "Released", reason, channel: "System" });
          event(by, `${policyId} hold released`);
        },

        assignOwner: (ids, owner, by) => {
          const at = tick();
          set((s) => ({ owners: { ...s.owners, ...Object.fromEntries(ids.map((id) => [id, owner])) } }));
          for (const id of ids) pushRow({ id: `U-${id}-${at}-o`, policyId: id, at, step: "Owner assigned", executor: by, executorKind: "person", result: `Owner: ${owner}`, channel: "System" });
        },

        sendPaymentLink: (policyId, by) => {
          const at = tick();
          const ps = usePersistencyStore.getState();
          const p = ps.overrides[policyId];
          const base = BASE_POLICIES[POLICY_INDEX.get(policyId) ?? -1];
          const touches = (p?.touchesLast30d ?? base?.touchesLast30d ?? 0) + 1;
          ps.patchPolicy(policyId, { touchesLast30d: touches, lastTouch: at.slice(0, 10), lastTouchChannel: "WhatsApp" });
          pushRow({ id: `U-${policyId}-${at}-pl`, policyId, at, step: "Payment link sent", executor: by, executorKind: "person", result: "Sent", channel: "WhatsApp", offers: ["Payment link"], checks: ["Paid since the list: not paid", "Not on hold", "Contact policy: inside hours, under the cap, registered number"] });
        },

        saveView: (v) => set((s) => ({ savedViews: [...s.savedViews.filter((x) => !(x.page === v.page && x.name === v.name)), { ...v, id: `V${Date.now()}` }] })),
        deleteView: (id) => set((s) => ({ savedViews: s.savedViews.filter((v) => v.id !== id) })),

        saveDraft: (key, data, author, note) => {
          const list = versionsOf(key);
          const last = list[list.length - 1];
          const at = tick();
          if (last && last.status === "Draft") {
            putVersions(key, [...list.slice(0, -1), { ...last, data, at, author, note: note ?? last.note, returnReason: last.returnReason }]);
            return last.no;
          }
          const no = (last?.no ?? 0) + 1;
          putVersions(key, [...list, { no, status: "Draft", author, at, note: note ?? "", data }]);
          return no;
        },

        discardDraft: (key) => {
          const list = versionsOf(key);
          if (list[list.length - 1]?.status === "Draft") putVersions(key, list.slice(0, -1));
        },

        restoreVersion: (key, no, author) => {
          const v = versionsOf(key).find((x) => x.no === no);
          if (!v) return 0;
          get().discardDraft(key);
          return get().saveDraft(key, structuredClone(v.data), author, `Restored from version ${no}`);
        },

        attachSim: (key, run) => {
          const list = versionsOf(key);
          const last = list[list.length - 1];
          if (!last) return;
          putVersions(key, [...list.slice(0, -1), { ...last, sims: [run, ...(last.sims ?? [])] }]);
        },

        addReviewNote: (key, note) => {
          const list = versionsOf(key);
          const last = list[list.length - 1];
          if (last && last.status === "Draft") putVersions(key, [...list.slice(0, -1), { ...last, reviewNotes: [...(last.reviewNotes ?? []), note] }]);
          else {
            get().saveDraft(key, structuredClone(last?.data), "Review note", "Notes from task review");
            const l2 = versionsOf(key);
            const d = l2[l2.length - 1]!;
            putVersions(key, [...l2.slice(0, -1), { ...d, reviewNotes: [note] }]);
          }
        },

        submit: (a) => {
          const id = `AP-${300 + get().approvals.length + get().clock}`;
          const at = tick();
          const key = `${a.kind}:${a.objectId}`;
          if (a.versionNo !== undefined && a.kind !== "executor" && a.kind !== "experiment") {
            const list = versionsOf(key);
            putVersions(key, list.map((v) => (v.no === a.versionNo ? { ...v, status: "In review" as const, returnReason: undefined } : v)));
          }
          set((s) => ({ approvals: [{ ...a, id, at, status: "waiting", signoffs: [] }, ...s.approvals.filter((x) => !(x.status === "waiting" && x.kind === a.kind && x.objectId === a.objectId))] }));
          event(a.requestedBy, `Submitted for review: ${a.objectName}${a.versionNo ? ` version ${a.versionNo}` : ""}`);
          return id;
        },

        approve: (id, role, name, effectiveFrom) => {
          const a = get().approvals.find((x) => x.id === id);
          if (!a || a.status !== "waiting" || !a.needs.includes(role) || a.signoffs.some((s) => s.role === role)) return "none";
          const at = tick();
          const signoffs = [...a.signoffs, { role, name, at }];
          const done = a.needs.every((r) => signoffs.some((s) => s.role === r));
          const eff = effectiveFrom ?? a.effectiveFrom;
          set((s) => ({ approvals: s.approvals.map((x) => (x.id === id ? { ...x, signoffs, ...(done ? { status: "approved" as const, decidedBy: signoffs.map((z) => z.name).join(", "), decidedAt: at, effectiveFrom: eff } : {}) } : x)) }));
          if (done) applyApproval({ ...a, signoffs }, eff, at);
          event(name, `${done ? "Approved" : "Signed off"}: ${a.objectName}${a.versionNo ? ` version ${a.versionNo}` : ""}`);
          return done ? "approved" : "signed";
        },

        returnApproval: (id, name, reason) => {
          const a = get().approvals.find((x) => x.id === id);
          if (!a) return;
          const at = tick();
          set((s) => ({ approvals: s.approvals.map((x) => (x.id === id ? { ...x, status: "returned" as const, decidedBy: name, decidedAt: at, reason } : x)) }));
          const key = `${a.kind}:${a.objectId}`;
          if (a.versionNo !== undefined) putVersions(key, versionsOf(key).map((v) => (v.no === a.versionNo ? { ...v, status: "Draft" as const, returnReason: reason } : v)));
          if (a.kind === "rule") {
            const ps = usePersistencyStore.getState();
            const r = ps.rules.find((x) => x.id === a.objectId);
            if (r && r.status === "In review") ps.upsertRule({ ...r, status: "Draft" });
          }
          if (a.kind === "experiment") set((s) => ({ experiments: s.experiments.map((e) => (e.id === a.objectId ? { ...e, status: "Draft" } : e)) }));
          event(name, `Returned: ${a.objectName} (${reason})`);
        },

        pauseAgent: (id, by, reason) => {
          set((s) => ({ agentPause: { ...s.agentPause, [id]: { at: tick(), by, reason } } }));
          event(by, `Paused agent ${id}: ${reason}`);
        },
        resumeAgent: (id, by) => {
          set((s) => {
            const agentPause = { ...s.agentPause };
            delete agentPause[id];
            return { agentPause };
          });
          event(by, `Resumed agent ${id}`);
        },
        setPauseAll: (on, by, reason) => {
          usePersistencyStore.getState().setKillSwitch(on);
          event(by, on ? `Paused all outreach: ${reason}` : "Resumed all outreach");
        },
        addTestNumber: (n) => set((s) => ({ testNumbers: [...new Set([...s.testNumbers, n])] })),
        sendTest: (task) => set((s) => ({ testTasks: [{ ...task, at: tick() }, ...s.testTasks] })),

        retryTask: (qid, by) => {
          const q = [...QUEUE, ...get().extraQueue].find((x) => x.id === qid);
          if (!q) return;
          const cur = get().queue[qid];
          set((s) => ({ queue: { ...s.queue, [qid]: { ...cur, retries: (cur?.retries ?? q.retries) + 1, status: "Retried", deadline: new Date(NOW.getTime() + 24 * 3_600_000).toISOString() } } }));
          get().addActivity({ policyId: q.policyId, step: `Retry: ${q.task}`, executor: q.executor, executorKind: "system", result: "Retried now", workflow: q.workflow, reason: `Requested by ${by}` });
        },
        moveTask: (qid, to, by) => {
          const q = [...QUEUE, ...get().extraQueue].find((x) => x.id === qid);
          if (!q) return;
          const newId = `Q-M${get().extraQueue.length + 1}`;
          const at = tick();
          set((s) => ({
            queue: { ...s.queue, [qid]: { ...s.queue[qid], closed: `Moved to ${to}` } },
            extraQueue: [{ ...q, id: newId, executor: to, retries: 0, status: "In flight", deadline: new Date(NOW.getTime() + 48 * 3_600_000).toISOString() }, ...s.extraQueue],
          }));
          pushRow({ id: `U-${q.policyId}-${at}-m1`, policyId: q.policyId, at, step: `Task closed: ${q.task}`, executor: q.executor, executorKind: "system", result: `Moved to ${to}`, workflow: q.workflow, linkedTo: newId, reason: `Moved by ${by}` });
          pushRow({ id: `U-${q.policyId}-${at}-m2`, policyId: q.policyId, at, step: `Task opened: ${q.task}`, executor: to, executorKind: to.includes("agent") ? "agent" : "person", result: "Open", workflow: q.workflow, linkedTo: qid, reason: `Moved from ${q.executor}` });
        },
        sendToLead: (qid, by) => get().moveTask(qid, "Team lead", by),
        setHandoffRules: (rules, by) => {
          set({ handoffRules: rules });
          event(by, "Handoff rules updated");
        },
        setOrchestration: (o, by) => {
          set({ orchestration: o });
          event(by, "Orchestration settings updated");
        },

        updateExecutor: (id, patch, by, change) => {
          const at = tick();
          set((s) => ({ executors: s.executors.map((e) => (e.id === id ? { ...e, ...patch } : e)), execHistory: [{ id, at, by, change }, ...s.execHistory] }));
        },

        recordImport: (adapterId, r) => {
          const at = tick();
          set((s) => ({ fileHistory: { ...s.fileHistory, [adapterId]: [{ ...r, id: `${adapterId}-u${s.clock}`, at, notes: [] }, ...(s.fileHistory[adapterId] ?? [])] } }));
        },
        addFileNote: (adapterId, receiptId, note, by) => {
          set((s) => ({ fileNotes: { ...s.fileNotes, [receiptId]: [...(s.fileNotes[receiptId] ?? []), `${by}: ${note}`] } }));
          event(by, `Note on ${adapterId}: ${note}`);
        },
        saveMapping: (adapterId, mapping, dateFormat) => set((s) => ({ mappings: { ...s.mappings, [adapterId]: { version: (s.mappings[adapterId]?.version ?? 1) + 1, mapping, dateFormat } } })),
        setImported: (key) => set((s) => ({ imported: { ...s.imported, [key]: true } })),
        matchReceipt: (receipt, policyId, by) => {
          set((s) => ({ matched: { ...s.matched, [receipt]: policyId } }));
          usePersistencyStore.getState().markPaid([policyId]);
          get().addActivity({ policyId, step: "Receipt matched", executor: by, executorKind: "person", result: `Paid (${receipt})`, channel: "Payment" });
        },
        createList: (l) => {
          const id = `L-${String(get().outboundLists.length + 1).padStart(3, "0")}`;
          set((s) => ({ outboundLists: [{ ...l, id, at: tick(), sent: false }, ...s.outboundLists] }));
          return id;
        },
        markListSent: (id) => set((s) => ({ outboundLists: s.outboundLists.map((l) => (l.id === id ? { ...l, sent: true } : l)) })),

        saveExperiment: (e) => set((s) => ({ experiments: s.experiments.some((x) => x.id === e.id) ? s.experiments.map((x) => (x.id === e.id ? e : x)) : [e, ...s.experiments] })),
        decideProposal: (id, st) => set((s) => ({ proposals: { ...s.proposals, [id]: { ...st, at: tick() } } })),
        createWorkflow: (name, stage, by) => {
          const code = `N${get().newWorkflows.length + 1}`;
          set((s) => ({ newWorkflows: [...s.newWorkflows, { code, name, stage, createdBy: by }] }));
          return code;
        },
        archiveWorkflow: (code) => set((s) => ({ archived: [...new Set([...s.archived, code])] })),
        renameWorkflow: (code, name) => set((s) => ({ wfNames: { ...s.wfNames, [code]: name }, newWorkflows: s.newWorkflows.map((w) => (w.code === code ? { ...w, name } : w)) })),
        log: event,

        reset: () => {
          useWork.persist.clearStorage();
          set(initial());
        },
      };

      function applyApproval(a: Approval, effectiveFrom: string | undefined, at: string) {
        const key = `${a.kind}:${a.objectId}`;
        const approver = a.signoffs.map((s) => s.name).join(", ");
        if (a.versionNo !== undefined && (a.kind === "rule" || a.kind === "workflow" || a.kind === "agent" || a.kind === "stage")) {
          putVersions(
            key,
            versionsOf(key).map((v) =>
              v.no === a.versionNo
                ? { ...v, status: "Active" as const, approver, approvedAt: at, effectiveFrom, reviewedCalls: a.kind === "agent" ? 0 : v.reviewedCalls }
                : v.status === "Active"
                  ? { ...v, status: "Retired" as const }
                  : v,
            ),
          );
        }
        if (a.kind === "rule") {
          const ps = usePersistencyStore.getState();
          const v = versionsOf(key).find((x) => x.no === a.versionNo);
          const current = ps.rules.find((r) => r.id === a.objectId);
          let rule: Rule | undefined = (v?.data as Rule | undefined) ?? current;
          if (!v && current && a.payload && typeof a.payload === "object") {
            const p = a.payload as { cohort?: string[]; priority?: number };
            rule = { ...current, when: { ...current.when, ...(p.cohort ? { cohort: p.cohort } : {}) }, priority: p.priority ?? current.priority };
          }
          if (rule) ps.upsertRule({ ...rule, status: "Active", version: a.versionNo ?? (rule.version ?? 1), approver, effectiveFrom: effectiveFrom ?? rule.effectiveFrom, lastChanged: at });
        }
        if (a.kind === "executor" && a.payload) {
          const p = a.payload as { id: string; workflow: string; share: number; mode?: string };
          const e = get().executors.find((x) => x.id === p.id);
          if (e) get().updateExecutor(p.id, { shares: { ...e.shares, [p.workflow]: p.share } }, approver, `${p.workflow} share ${e.shares[p.workflow] ?? 0} to ${p.share} (approved)`);
        }
        if (a.kind === "experiment") set((s) => ({ experiments: s.experiments.map((e) => (e.id === a.objectId ? { ...e, status: "Scheduled" } : e)) }));
      }
    },
    {
      name: WORK_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== "function")) as Partial<WorkState>,
      onRehydrateStorage: () => (state) => {
        if (state?.events.length) eventSeq = Math.max(...state.events.map((e) => e.id)) + 1;
      },
    },
  ),
);

/* ---------- Seeded versions, merged with saved ones ---------- */

export function seedVersions(key: string): Version<unknown>[] {
  const [kind, id] = key.split(":") as [ApprovalKind, string];
  if (kind === "agent") return seedAgentVersions(id);
  if (kind === "workflow") return seedWorkflowVersions(id);
  if (kind === "stage") return seedStageVersions();
  if (kind === "rule") return seedRuleVersions(id);
  return [];
}

const RULE_HISTORY: Record<string, { note: string; change: Partial<Rule> }[]> = {
  D2: [{ note: "First release: ₹5 lakh limit", change: { conds: [[{ dim: "ticketBand", op: "above", values: [], n: 500_000 }]] } }, { note: "Added early lapse", change: {} }],
  R05: [{ note: "First release: reminder the day before", change: { then: { workflowId: "R3", action: "WhatsApp reminder a day before promised date", executor: "WhatsApp vendor", delayHours: 20 } } }],
  R10: [{ note: "First release", change: {} }],
  R13: [{ note: "First release", change: { priority: 35 } }, { note: "Priority 30", change: {} }],
  R03: [{ note: "First release: Lowest propensity only", change: { when: { state: ["Grace"], cohort: ["Lowest propensity"] } } }],
};

function seedRuleVersions(id: string): Version<unknown>[] {
  const rule = usePersistencyStore.getState().rules.find((r) => r.id === id);
  if (!rule) return [];
  const hist = RULE_HISTORY[id] ?? [];
  const current = rule.version ?? hist.length + 1;
  const activeNo = rule.status === "In review" || rule.status === "Draft" ? 0 : current;
  const older: Version<unknown>[] = hist.map((h, i) => ({
    no: i + 1,
    status: "Retired",
    author: i % 2 ? "Head of Persistency" : "MIS and analytics",
    at: new Date(Date.UTC(2026, 3 + i * 2, 10, 6)).toISOString(),
    note: h.note,
    approver: "Head of Persistency",
    approvedAt: new Date(Date.UTC(2026, 3 + i * 2, 11, 6)).toISOString(),
    data: { ...rule, ...h.change, version: i + 1 },
  }));
  const latest: Version<unknown> = {
    no: Math.max(current, older.length + 1),
    status: rule.status === "Retired" ? "Retired" : rule.status === "In review" ? "In review" : rule.status === "Draft" ? "Draft" : "Active",
    author: "MIS and analytics",
    at: "2026-10-01T05:00:00.000Z",
    note: hist.length ? "Current rule" : "First release",
    approver: activeNo ? "Head of Persistency" : undefined,
    approvedAt: activeNo ? "2026-10-01T06:00:00.000Z" : undefined,
    data: rule,
  };
  const list = [...older.slice(0, latest.no - 1), latest];
  if (id === "R16") list.push({ no: 2, status: "In review", author: "Head of Persistency", at: "2026-10-25T07:20:00.000Z", note: "Also covers cohort Low propensity", data: { ...rule, when: { ...rule.when, cohort: ["Moderate propensity", "Low propensity", "Medium", "Band 3"] }, priority: 24, version: 2 } });
  return list;
}

export function useVersions<T>(key: string): Version<T>[] {
  const saved = useWork((s) => s.versions[key]);
  const rules = usePersistencyStore((s) => (key.startsWith("rule:") ? s.rules : null));
  return useMemo(() => (saved ?? seedVersions(key)) as Version<T>[], [saved, key, rules]);
}

export function activeVersion<T>(list: Version<T>[]): Version<T> | undefined {
  return [...list].reverse().find((v) => v.status === "Active") ?? [...list].reverse().find((v) => v.status === "Retired") ?? list[0];
}

export function useStageSettings(): StageSettings {
  const list = useVersions<StageSettings>("stage:settings");
  return activeVersion(list)!.data;
}

/** Combined queue with in-session retries, moves and cancellations applied. */
export function useQueue(): (QueueTask & { closed?: string | undefined })[] {
  const queue = useWork((s) => s.queue);
  const extra = useWork((s) => s.extraQueue);
  return useMemo(() => [...extra, ...QUEUE].map((q) => ({ ...q, ...queue[q.id] })), [queue, extra]);
}

export function resetAllWork() {
  useWork.getState().reset();
  usePersistencyStore.getState().resetDemo();
}
