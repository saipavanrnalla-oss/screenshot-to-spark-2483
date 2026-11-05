import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RoleId } from "@/config/users";

export type Theme = "dark" | "light";

interface SessionState {
  userId: RoleId | null;
  theme: Theme;
  signIn: (id: RoleId) => void;
  signOut: () => void;
  setTheme: (t: Theme) => void;
}

/** Signed-in test user and theme. Persisted so a reload keeps both. */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      theme: "light",
      signIn: (id) => set({ userId: id }),
      signOut: () => set({ userId: null }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "pct-session-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ userId: s.userId, theme: s.theme }),
    },
  ),
);
