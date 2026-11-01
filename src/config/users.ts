import type { ModuleId } from "./modules";

export type RoleId = "head" | "mis" | "compliance" | "remittance" | "executive";

/** Sidebar entries. Each belongs to a module (or none, for shared pages such as Approvals). */
export type NavKey =
  | "overview"
  | "stages"
  | "policies"
  | "approvals"
  | "cohorts"
  | "rules"
  | "workflows"
  | "agents"
  | "work"
  | "collections"
  | "data"
  | "contact-policy"
  | "reports"
  | "admin"
  | "positioning";

export type Permission =
  | "rules.edit"
  | "rules.approve"
  | "workflows.edit"
  | "workflows.approve"
  | "agents.edit"
  | "agents.approve"
  | "agents.thresholds"
  | "agents.pause"
  | "outreach.pauseAll"
  | "stages.edit"
  | "stages.approve"
  | "executors.edit"
  | "policies.act"
  | "policies.hold"
  | "files.import"
  | "files.importPayments"
  | "files.map"
  | "receipts.match"
  | "lists.create"
  | "reports.packs"
  | "experiments.edit";

export interface TestUser {
  id: RoleId;
  name: string;
  role: string;
  scope: string;
  landing: ModuleId;
  /** Sidebar entries in order. Hidden modules only show when the registry enables them. */
  nav: NavKey[];
  /** Entries the role may open but not change. */
  readOnly: NavKey[];
  can: Permission[];
}

const HIDDEN_FOR_HEAD: NavKey[] = ["overview", "cohorts", "work", "collections", "contact-policy", "admin", "positioning"];

export const USERS: TestUser[] = [
  {
    id: "head",
    name: "Head of Persistency",
    role: "Head of Persistency",
    scope: "Whole book",
    landing: "journeys",
    nav: ["stages", "policies", "approvals", "rules", "workflows", "agents", "data", "reports", ...HIDDEN_FOR_HEAD],
    readOnly: ["data"],
    can: [
      "rules.edit", "rules.approve", "workflows.edit", "workflows.approve", "agents.edit", "agents.approve", "agents.thresholds",
      "stages.edit", "stages.approve", "executors.edit", "policies.act", "policies.hold", "reports.packs", "experiments.edit",
    ],
  },
  {
    id: "mis",
    name: "MIS and analytics",
    role: "MIS and analytics",
    scope: "Whole book",
    landing: "data",
    nav: ["stages", "policies", "approvals", "rules", "workflows", "agents", "data", "reports", "cohorts", "admin"],
    readOnly: [],
    can: ["rules.edit", "workflows.edit", "stages.edit", "agents.thresholds", "files.import", "files.importPayments", "files.map", "lists.create", "reports.packs", "experiments.edit"],
  },
  {
    id: "compliance",
    name: "Compliance and quality",
    role: "Compliance and quality",
    scope: "Whole book",
    landing: "workflows",
    nav: ["stages", "policies", "approvals", "rules", "workflows", "agents", "data", "reports", "contact-policy"],
    readOnly: ["rules", "data", "reports"],
    can: ["rules.approve", "workflows.approve", "agents.approve", "agents.pause", "outreach.pauseAll", "policies.hold"],
  },
  {
    id: "remittance",
    name: "Remittance and operations",
    role: "Remittance and operations",
    scope: "Payments and mandates",
    landing: "data",
    nav: ["stages", "policies", "data", "work"],
    readOnly: ["stages"],
    can: ["files.import", "files.importPayments", "receipts.match", "lists.create", "policies.act"],
  },
  {
    id: "executive",
    name: "Executive",
    role: "Executive",
    scope: "Whole book",
    landing: "measurement",
    nav: ["stages", "reports", "collections"],
    readOnly: ["stages"],
    can: ["reports.packs"],
  },
];

export function userById(id: string | null | undefined): TestUser | undefined {
  return USERS.find((u) => u.id === id);
}

export function can(user: TestUser | undefined, permission: Permission): boolean {
  return !!user && user.can.includes(permission);
}
