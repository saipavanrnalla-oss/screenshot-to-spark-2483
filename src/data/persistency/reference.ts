import type { Language, Region } from "./types";

export const INSURER_NAME = "Sample Life Insurance";

export const FIRST_NAMES = [
  "Aarav", "Vivaan", "Ananya", "Diya", "Ishaan", "Kavya", "Rohan", "Meera", "Arjun", "Priya",
  "Siddharth", "Nisha", "Rahul", "Sneha", "Karthik", "Lakshmi", "Imran", "Farah", "Joseph", "Anita",
  "Suresh", "Deepa", "Vikram", "Pooja", "Manoj", "Revathi", "Harpreet", "Sanjay", "Neha", "Amit",
  "Swati", "Rajesh", "Kiran", "Nikhil", "Shreya", "Abhishek", "Divya", "Varun", "Asha", "Gautam",
] as const;

export const LAST_NAMES = [
  "Sharma", "Iyer", "Reddy", "Nair", "Patel", "Desai", "Kulkarni", "Banerjee", "Das", "Rao",
  "Menon", "Gupta", "Singh", "Khan", "Fernandes", "Joshi", "Pillai", "Shah", "Mehta", "Chatterjee",
  "Naidu", "Hegde", "Bose", "Verma", "Mishra", "Ghosh", "Shetty", "Kaur", "Agarwal", "Pandey",
] as const;

export interface CityRef {
  city: string;
  region: Region;
  languages: readonly (readonly [Language, number])[];
  weight: number;
}

export const CITIES: CityRef[] = [
  { city: "Mumbai", region: "West", weight: 12, languages: [["Marathi", 4], ["Hindi", 4], ["English", 3], ["Gujarati", 1]] },
  { city: "Pune", region: "West", weight: 6, languages: [["Marathi", 6], ["English", 3], ["Hindi", 2]] },
  { city: "Ahmedabad", region: "West", weight: 6, languages: [["Gujarati", 7], ["Hindi", 2], ["English", 2]] },
  { city: "Surat", region: "West", weight: 3, languages: [["Gujarati", 7], ["Hindi", 2], ["English", 1]] },
  { city: "Delhi", region: "North", weight: 12, languages: [["Hindi", 7], ["English", 4]] },
  { city: "Lucknow", region: "North", weight: 5, languages: [["Hindi", 8], ["English", 2]] },
  { city: "Jaipur", region: "North", weight: 5, languages: [["Hindi", 8], ["English", 2]] },
  { city: "Chandigarh", region: "North", weight: 3, languages: [["Hindi", 6], ["English", 4]] },
  { city: "Kolkata", region: "East", weight: 8, languages: [["Bengali", 7], ["English", 2], ["Hindi", 2]] },
  { city: "Patna", region: "East", weight: 4, languages: [["Hindi", 9], ["English", 1]] },
  { city: "Bhubaneswar", region: "East", weight: 3, languages: [["English", 5], ["Hindi", 4], ["Bengali", 1]] },
  { city: "Chennai", region: "South", weight: 9, languages: [["Tamil", 7], ["English", 3]] },
  { city: "Coimbatore", region: "South", weight: 3, languages: [["Tamil", 8], ["English", 2]] },
  { city: "Bengaluru", region: "South", weight: 10, languages: [["Kannada", 4], ["English", 5], ["Tamil", 1], ["Telugu", 1]] },
  { city: "Mysuru", region: "South", weight: 2, languages: [["Kannada", 8], ["English", 2]] },
  { city: "Hyderabad", region: "South", weight: 8, languages: [["Telugu", 6], ["English", 3], ["Hindi", 2]] },
  { city: "Vijayawada", region: "South", weight: 3, languages: [["Telugu", 8], ["English", 2]] },
  { city: "Kochi", region: "South", weight: 3, languages: [["English", 7], ["Tamil", 1]] },
];

/** Fictional bank partners for bancassurance. */
export const BANK_PARTNERS = [
  "Deccan Commercial Bank",
  "Northern Union Bank",
  "Coastal Co-operative Bank",
  "Metro City Bank",
  "Eastern Rural Bank",
  "Western Federal Bank",
] as const;

export interface Vendor {
  id: string;
  name: string;
  does: string;
  payout: "Fixed" | "Variable" | "Per message" | "Per minute" | "Platform";
  channel: string;
  defaultMode: VendorMode;
}
export type VendorMode = "Observe" | "Direct" | "Replace-in-slice";
export const VENDOR_MODES: VendorMode[] = ["Observe", "Direct", "Replace-in-slice"];

export const VENDORS: Vendor[] = [
  { id: "pace-setters", name: "Pace Setters", does: "Telecalling for renewals and grace", payout: "Fixed", channel: "Telecalling", defaultMode: "Observe" },
  { id: "ats", name: "ATS", does: "Telecalling for lapse recovery", payout: "Variable", channel: "Telecalling", defaultMode: "Direct" },
  { id: "paylocal", name: "Paylocal", does: "WhatsApp reminders and payment links", payout: "Per message", channel: "WhatsApp", defaultMode: "Direct" },
  { id: "ubona", name: "Ubona", does: "Outbound voice bot", payout: "Per minute", channel: "Voice bot", defaultMode: "Observe" },
  { id: "desible", name: "Desible", does: "Decisions, voice and WhatsApp in agreed slices", payout: "Platform", channel: "Voice and WhatsApp", defaultMode: "Replace-in-slice" },
];

export interface WarmingStation {
  n: number;
  dayOffset: number;
  label: string;
  channel: string;
  content: string;
}

export const WARMING_STATIONS: WarmingStation[] = [
  { n: 1, dayOffset: -365, label: "Year starts", channel: "WhatsApp", content: "Thank-you and policy summary" },
  { n: 2, dayOffset: -300, label: "Benefit recap", channel: "WhatsApp", content: "What your cover does, in your language" },
  { n: 3, dayOffset: -240, label: "Mandate check", channel: "WhatsApp", content: "Confirm autopay or mandate is active" },
  { n: 4, dayOffset: -180, label: "Half-year", channel: "Voice", content: "Short check-in call, update contact details" },
  { n: 5, dayOffset: -150, label: "Value update", channel: "WhatsApp", content: "Fund value or bonus statement" },
  { n: 6, dayOffset: -120, label: "Festival note", channel: "WhatsApp", content: "Greeting with cover reminder" },
  { n: 7, dayOffset: -90, label: "Window opens", channel: "WhatsApp", content: "Renewal date and amount" },
  { n: 8, dayOffset: -45, label: "Plan payment", channel: "Voice", content: "Confirm how they will pay" },
  { n: 9, dayOffset: -15, label: "Final nudge", channel: "WhatsApp", content: "Payment link and due date" },
];

export const GRACE_DAYS = { Monthly: 15, other: 30 } as const;
export const EARLY_LAPSE_MAX_DAYS = 180;

export const MONTH_PLAN_CR = 182;
export const MONTH_NAME = "October 2026";
