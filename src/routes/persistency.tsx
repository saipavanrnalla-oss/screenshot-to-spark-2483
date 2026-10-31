import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { AppShell } from "@/components/shell/app-shell";

const shellSearch = z.object({
  // Optional so links inside Persistency can carry the current values forward.
  as: fallback(z.string().optional(), undefined),
  product: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency")({
  validateSearch: zodValidator(shellSearch),
  search: {
    // Keep persona and product on every link inside Persistency.
    middlewares: [
      ({ search, next }) => {
        const result = next(search);
        return { ...result, as: result.as ?? search.as, product: result.product ?? search.product };
      },
    ],
  },
  component: AppShell,
});
