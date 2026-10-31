import { generatePolicies } from "./generate";
import { generatePeople } from "./people";
import { buildAdapters } from "./files";

export * from "./types";
export * from "./metrics";
export * from "./reference";
export * from "./workflows";
export * from "./rules";
export * from "./scorecard";
export * from "./dates";
export * from "./derived";
export * from "./workflow-graphs";
export type { FileAdapter } from "./files";
export type { Person, PersonRole } from "./people";

/** One seeded book used by every page. */
export const BASE_POLICIES = generatePolicies();
export const PEOPLE = generatePeople();
export const FILE_ADAPTERS = buildAdapters(BASE_POLICIES);
export const STALE_WORKFLOWS = new Set(FILE_ADAPTERS.filter((a) => a.stale).flatMap((a) => a.feeds));

export const POLICY_INDEX = new Map(BASE_POLICIES.map((p, i) => [p.policyId, i]));
