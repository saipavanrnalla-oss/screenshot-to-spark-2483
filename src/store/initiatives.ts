import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** A slice the Head of Persistency raises to operations, with a target and a plan. */
export interface Initiative {
  id: string;
  title: string;
  period: 13 | 25;
  /** The drill path that defines the slice, e.g. [["Channel","Bancassurance"],["Product","ULIP"]]. */
  slice: [string, string][];
  baseline: number;
  book: number;
  target: number;
  byDate: string;
  policies: number;
  atRisk: number;
  plan: string[];
  raisedBy: string;
  raisedAt: string;
  owner: string;
  status: "Raised" | "Accepted" | "In progress" | "Done";
  notes: { by: string; at: string; text: string }[];
}

interface State {
  items: Initiative[];
  raise: (i: Omit<Initiative, "id" | "status" | "notes" | "raisedAt">) => Initiative;
  setStatus: (id: string, s: Initiative["status"], by: string, note?: string) => void;
}

export const useInitiatives = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      raise: (i) => {
        const it: Initiative = { ...i, id: `IN-${String(get().items.length + 1).padStart(3, "0")}`, status: "Raised", notes: [], raisedAt: new Date().toISOString() };
        set({ items: [it, ...get().items] });
        return it;
      },
      setStatus: (id, s, by, note) =>
        set({
          items: get().items.map((x) => (x.id === id ? { ...x, status: s, notes: note ? [...x.notes, { by, at: new Date().toISOString(), text: note }] : x.notes } : x)),
        }),
    }),
    { name: "pct-initiatives-v1", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);
