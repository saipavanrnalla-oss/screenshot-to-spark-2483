import type { Policy } from "./types";
import { hashId } from "./derived";

/** State and the districts a city's policies sit in. Derived from the city, so the seeded book is unchanged. */
const CITY_GEO: Record<string, { state: string; districts: [string, string, string] }> = {
  Mumbai: { state: "Maharashtra", districts: ["Mumbai City", "Mumbai Suburban", "Thane"] },
  Pune: { state: "Maharashtra", districts: ["Pune", "Satara", "Ahmednagar"] },
  Ahmedabad: { state: "Gujarat", districts: ["Ahmedabad", "Gandhinagar", "Mehsana"] },
  Surat: { state: "Gujarat", districts: ["Surat", "Navsari", "Bharuch"] },
  Delhi: { state: "Delhi", districts: ["New Delhi", "South Delhi", "North West Delhi"] },
  Lucknow: { state: "Uttar Pradesh", districts: ["Lucknow", "Unnao", "Barabanki"] },
  Jaipur: { state: "Rajasthan", districts: ["Jaipur", "Alwar", "Ajmer"] },
  Chandigarh: { state: "Chandigarh", districts: ["Chandigarh", "Mohali", "Panchkula"] },
  Kolkata: { state: "West Bengal", districts: ["Kolkata", "Howrah", "North 24 Parganas"] },
  Patna: { state: "Bihar", districts: ["Patna", "Nalanda", "Vaishali"] },
  Bhubaneswar: { state: "Odisha", districts: ["Khordha", "Cuttack", "Puri"] },
  Chennai: { state: "Tamil Nadu", districts: ["Chennai", "Chengalpattu", "Kancheepuram"] },
  Coimbatore: { state: "Tamil Nadu", districts: ["Coimbatore", "Tiruppur", "Erode"] },
  Bengaluru: { state: "Karnataka", districts: ["Bengaluru Urban", "Bengaluru Rural", "Tumakuru"] },
  Mysuru: { state: "Karnataka", districts: ["Mysuru", "Mandya", "Chamarajanagar"] },
  Hyderabad: { state: "Telangana", districts: ["Hyderabad", "Rangareddy", "Medchal-Malkajgiri"] },
  Vijayawada: { state: "Andhra Pradesh", districts: ["NTR", "Krishna", "Guntur"] },
  Kochi: { state: "Kerala", districts: ["Ernakulam", "Alappuzha", "Thrissur"] },
};

export const stateOf = (p: Pick<Policy, "city">): string => CITY_GEO[p.city]?.state ?? "Other";
export const districtOf = (p: Pick<Policy, "city" | "policyId">): string => {
  const g = CITY_GEO[p.city];
  return g ? g.districts[hashId(p.policyId) % 3]! : p.city;
};

/** Tile-map positions (column, row) so the states sit roughly where they do on the map of India. */
export const STATE_TILES: { state: string; short: string; col: number; row: number }[] = [
  { state: "Chandigarh", short: "CH", col: 2, row: 0 },
  { state: "Rajasthan", short: "RJ", col: 1, row: 1 },
  { state: "Delhi", short: "DL", col: 2, row: 1 },
  { state: "Uttar Pradesh", short: "UP", col: 3, row: 1 },
  { state: "Bihar", short: "BR", col: 4, row: 1 },
  { state: "Gujarat", short: "GJ", col: 0, row: 2 },
  { state: "West Bengal", short: "WB", col: 5, row: 2 },
  { state: "Maharashtra", short: "MH", col: 1, row: 3 },
  { state: "Odisha", short: "OD", col: 4, row: 3 },
  { state: "Karnataka", short: "KA", col: 1, row: 4 },
  { state: "Telangana", short: "TS", col: 2, row: 4 },
  { state: "Andhra Pradesh", short: "AP", col: 3, row: 4 },
  { state: "Kerala", short: "KL", col: 1, row: 5 },
  { state: "Tamil Nadu", short: "TN", col: 2, row: 5 },
];
