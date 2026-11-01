import { Rng } from "./rng";
import { FIRST_NAMES, LAST_NAMES } from "./reference";

export type PersonRole =
  | "CXO"
  | "Head of Persistency"
  | "Regional lead"
  | "Team lead"
  | "Agent"
  | "Sales officer"
  | "Zonal manager"
  | "Bank partner manager"
  | "High-value desk"
  | "Surrender retention"
  | "Underwriter"
  | "Ops / remittance"
  | "MIS / analytics"
  | "Compliance / quality";

export interface Person {
  id: string;
  name: string;
  role: PersonRole;
  region: string;
}

const COUNTS: [PersonRole, number][] = [
  ["CXO", 1],
  ["Head of Persistency", 1],
  ["Regional lead", 3],
  ["Team lead", 12],
  ["Agent", 60],
  ["Sales officer", 40],
  ["Zonal manager", 8],
  ["Bank partner manager", 6],
  ["High-value desk", 4],
  ["Surrender retention", 5],
  ["Underwriter", 4],
  ["Ops / remittance", 4],
  ["MIS / analytics", 3],
  ["Compliance / quality", 3],
];

const REGIONS = ["North", "South", "East", "West"];

export function generatePeople(): Person[] {
  const rng = new Rng(4242);
  const used = new Set<string>();
  const people: Person[] = [];
  for (const [role, n] of COUNTS) {
    for (let i = 0; i < n; i++) {
      let name = "";
      do name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
      while (used.has(name));
      used.add(name);
      people.push({ id: `${role.replace(/[^a-z]/gi, "").toLowerCase()}-${i + 1}`, name, role, region: REGIONS[i % 4] ?? "North" });
    }
  }
  return people;
}
