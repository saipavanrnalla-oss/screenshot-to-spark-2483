import { create } from "zustand";

/**
 * The Ask Desible assistant: one conversation that stays open as the user moves between pages.
 * Kept in memory only; a page reload starts a new conversation.
 */
export interface AskTurn {
  id: number;
  q: string;
  qid: string | null;
  /** False while the answer is being worked out. */
  ready: boolean;
}

interface AskState {
  open: boolean;
  turns: AskTurn[];
  setOpen: (open: boolean) => void;
  toggle: () => void;
  ask: (q: string, qid: string | null) => void;
  clear: () => void;
}

let next = 1;

export const useAsk = create<AskState>()((set, get) => ({
  open: false,
  turns: [],
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
  ask: (q, qid) => {
    const id = next++;
    set({ open: true, turns: [...get().turns, { id, q, qid, ready: false }] });
    window.setTimeout(() => set({ turns: get().turns.map((t) => (t.id === id ? { ...t, ready: true } : t)) }), 900);
  },
  clear: () => set({ turns: [] }),
}));
