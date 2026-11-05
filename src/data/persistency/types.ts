export const PRODUCTS = ["ULIP", "Traditional", "Term"] as const;
export type Product = (typeof PRODUCTS)[number];
export const PRODUCT_FILTERS = ["All", ...PRODUCTS] as const;
export type ProductFilter = (typeof PRODUCT_FILTERS)[number];

export const PAYMENT_MODES = ["Monthly", "Quarterly", "Half-yearly", "Annual"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const INSTALMENTS_PER_YEAR: Record<PaymentMode, number> = {
  Monthly: 12,
  Quarterly: 4,
  "Half-yearly": 2,
  Annual: 1,
};

export const PAYMENT_METHODS = [
  "NACH/ECS mandate",
  "Credit card SI",
  "Cash/cheque",
  "UPI autopay",
  "Bank branch",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CHANNELS = ["Agency", "Bancassurance", "Online", "Direct"] as const;
export type Channel = (typeof CHANNELS)[number];

export const LANGUAGES = [
  "Hindi",
  "English",
  "Marathi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Bengali",
  "Gujarati",
] as const;
export type Language = (typeof LANGUAGES)[number];

export const PROFILES = ["Salaried", "Self-employed", "Senior", "HNI", "NRI"] as const;
export type CustomerProfile = (typeof PROFILES)[number];

export const ADVISOR_STATUSES = ["Active", "Inactive", "Left"] as const;
export type AdvisorStatus = (typeof ADVISOR_STATUSES)[number];

export const REGIONS = ["North", "South", "East", "West"] as const;
export type Region = (typeof REGIONS)[number];

export const STAGES = ["Sourcing", "Warming", "Renewal window", "Early lapse", "Late lapse"] as const;
export type Stage = (typeof STAGES)[number];

/** The four columns shown on the lifecycle; early and late lapse share one column. */
export const STAGE_COLUMNS = ["Sourcing", "Warming", "Renewal window", "Lapse and revival"] as const;
export type StageColumn = (typeof STAGE_COLUMNS)[number];
export function stageColumn(stage: Stage): StageColumn {
  return stage === "Early lapse" || stage === "Late lapse" ? "Lapse and revival" : stage;
}

export const HOLD_STATES = ["Complaint-hold", "Bereavement-hold", "Do-not-contact"] as const;
export type HoldState = (typeof HOLD_STATES)[number];

export type PolicyState =
  | "Welcome pending"
  | "PIVC pending"
  | "Free-look open"
  | `Warming station ${number}`
  | "Renewal window open"
  | "Promised"
  | "Paid"
  | "Grace"
  | "Lapsed early"
  | "Lapsed late"
  | "Revival offered"
  | "Revived"
  | "Surrender-intent"
  | HoldState;

export const ALL_STATES: PolicyState[] = [
  "Welcome pending",
  "PIVC pending",
  "Free-look open",
  ...Array.from({ length: 9 }, (_, i) => `Warming station ${i + 1}` as PolicyState),
  "Renewal window open",
  "Promised",
  "Paid",
  "Grace",
  "Lapsed early",
  "Lapsed late",
  "Revival offered",
  "Revived",
  "Surrender-intent",
  "Complaint-hold",
  "Bereavement-hold",
  "Do-not-contact",
];

export const INSURER_COHORTS = ["Highest propensity", "High propensity", "Moderate propensity", "Low propensity", "Lowest propensity"] as const;
export type InsurerCohort = (typeof INSURER_COHORTS)[number] | "Unscored";
export const RULES_COHORTS = ["High", "Medium", "Low"] as const;
export type RulesCohort = (typeof RULES_COHORTS)[number] | "Unscored";
export type StarterBand = 1 | 2 | 3 | 4 | 5;

export type CohortSet = "insurer" | "rules" | "starter";

export const REASON_CODES = [
  "None",
  "Money problem",
  "Forgot",
  "Lost interest",
  "Mis-sold",
  "Wants to surrender",
  "Will pay later",
  "Not reached",
  "Mandate bounce",
  "Mandate failed",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export type MonthDueStatus = "paid" | "promised" | "unpaid" | "upcoming";

export interface MonthDue {
  date: string;
  amount: number;
  status: MonthDueStatus;
  paidOn?: string | undefined;
  /** Paid at a bank branch: the receipt reaches the file a day late. */
  branchPayment?: boolean | undefined;
}

export interface Policy {
  policyId: string;
  customerName: string;
  product: Product;
  policyYear: number;
  paymentMode: PaymentMode;
  paymentMethod: PaymentMethod;
  channel: Channel;
  sourceBankOrAdvisor: string;
  annualisedPremium: number;
  instalmentAmount: number;
  city: string;
  region: Region;
  language: Language;
  customerProfile: CustomerProfile;
  advisorStatus: AdvisorStatus;
  priorLatePayments: number;
  insurerCohort: InsurerCohort;
  rulesCohort: RulesCohort;
  starterScore: number | null;
  starterBand: StarterBand | null;
  lifecycleStage: Stage;
  state: PolicyState;
  issueDate: string;
  monthsSinceIssue: number;
  /** Next renewal due date (policy anniversary) that drives the lifecycle. */
  dueDate: string;
  graceEnd: string;
  graceDays: number;
  lapseDate?: string | undefined;
  /** Month (from issue) of the first unpaid instalment, for lapsed policies. */
  lapseMonth?: number | undefined;
  instalmentsPaid: number;
  warmingStation?: number | undefined;
  lastTouch: string | null;
  lastTouchChannel: string | null;
  touchesLast30d: number;
  reasonCode: ReasonCode;
  monthDue?: MonthDue | undefined;
  revivedOn?: string | undefined;
  assignedVendor: string;
  /** Hidden latent risk used only by the generator. */
  latentRisk: number;
}

export type DimensionKey =
  | "product"
  | "policyYear"
  | "paymentMode"
  | "paymentMethod"
  | "channel"
  | "cohort"
  | "ticketBand"
  | "customerProfile"
  | "language"
  | "advisorStatus"
  | "stage"
  | "state"
  | "reasonCode"
  | "calendar"
  | "touchHistory"
  | "executor"
  | "insurer";

export type RuleLevel = "guardrail" | "insurer" | "rule";

export interface RuleThen {
  workflowId: string;
  action: string;
  executor: string;
  script?: string | undefined;
  offer?: string | undefined;
  approvals?: string | undefined;
  contactRule?: string | undefined;
  handoff?: string | undefined;
  target?: string | undefined;
  exclusions?: string | undefined;
  /** Hours from now when the action is scheduled. */
  delayHours: number;
  /** Stops outreach entirely (holds). */
  freeze?: boolean | undefined;
}

export type ConditionOp = "is" | "is not" | "is any of" | "above" | "below" | "between" | "within N days of";

/** One row of the rule editor's condition builder. */
export interface ConditionRow {
  dim: DimensionKey;
  op: ConditionOp;
  values: string[];
  /** Number for above, below, between (lower) and within N days of. */
  n?: number | undefined;
  /** Upper bound for between. */
  n2?: number | undefined;
}

export type RuleStatus = "Active" | "Draft" | "In review" | "Retired";

export interface Rule {
  id: string;
  name: string;
  stage: StageColumn | "Any";
  level: RuleLevel;
  priority: number;
  when: Partial<Record<DimensionKey, string[]>>;
  /** Condition groups from the rule editor: rows inside a group join with AND, groups join with OR. */
  conds?: ConditionRow[][] | undefined;
  then: RuleThen;
  effectiveFrom: string;
  effectiveTo?: string | undefined;
  needsApprovalFrom: string;
  locked?: boolean | undefined;
  source: "Insurer rule" | "Proposed by Desible, insurer to confirm";
  /** Only Active rules decide. Missing means Active. */
  status?: RuleStatus | undefined;
  version?: number | undefined;
  description?: string | undefined;
  notes?: string | undefined;
  lastChanged?: string | undefined;
  approver?: string | undefined;
}

export interface Decision {
  policyId: string;
  ruleId: string;
  ruleName: string;
  level: RuleLevel;
  matchedDimensions: Partial<Record<DimensionKey, string>>;
  action: string;
  workflowId: string;
  executor: string;
  scheduledAt: string;
  frozen: boolean;
  cancelledReason?: "Paid since the list" | "Kill switch on" | "Stale input" | undefined;
  conflictWith?: string[] | undefined;
}

export type TimelineKind = "event" | "touch" | "decision" | "state";
export interface TimelineEvent {
  at: string;
  kind: TimelineKind;
  title: string;
  detail?: string | undefined;
  channel?: string | undefined;
}

export type SimulatedEvent =
  | "Payment received"
  | "Bounce"
  | "Mandate failed"
  | "Customer says wants out"
  | "Complaint raised"
  | "Bereavement";

export const SIMULATED_EVENTS: SimulatedEvent[] = [
  "Payment received",
  "Bounce",
  "Mandate failed",
  "Customer says wants out",
  "Complaint raised",
  "Bereavement",
];
