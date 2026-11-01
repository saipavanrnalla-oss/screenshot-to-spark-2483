import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AppShell } from "@/components/shell/app-shell";
import { userById } from "@/config/users";
import { useSession } from "@/store/session";

const shellSearch = z.object({
  // Optional so links inside Persistency can carry the current values forward.
  as: fallback(z.string().optional(), undefined),
  product: fallback(z.string().optional(), undefined),
  // Developer override: ?modules=all shows every hidden page and banner.
  modules: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency")({
  // The signed-in user and saved work live in the browser, so these pages render there.
  ssr: false,
  validateSearch: zodValidator(shellSearch),
  search: {
    // Keep persona, product and the override on every link inside Persistency.
    middlewares: [
      ({ search, next }) => {
        const result = next(search);
        return {
          ...result,
          as: result.as ?? search.as,
          product: result.product ?? search.product,
          modules: result.modules ?? search.modules,
        };
      },
    ],
  },
  beforeLoad: () => {
    if (!userById(useSession.getState().userId)) throw redirect({ to: "/login" });
  },
  component: AppShell,
});
