import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/ds/primitives";
import { PolicyTable } from "@/components/persistency/policy-table";
import { PolicyDrawer } from "@/components/persistency/policy-drawer";
import { PRODUCTS, STAGES } from "@/data/persistency";
import { gate } from "@/lib/gate";
import { num } from "@/lib/format";
import { usePolicies } from "@/store/persistency";

const policiesSearch = z.object({
  policy: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/persistency/policies")({
  validateSearch: zodValidator(policiesSearch),
  beforeLoad: ({ search }) => gate("policies", search),
  head: () => ({
    meta: [
      { title: "Policies · Persistency · desible.ai" },
      { name: "description", content: "Every policy with its stage, cohort, payment method, next step and owner." },
      { property: "og:title", content: "Policies · Persistency · desible.ai" },
      { property: "og:description", content: "Every policy with its stage, cohort, payment method, next step and owner." },
    ],
  }),
  component: PoliciesPage,
});

const ALL = "all";

function PoliciesPage() {
  const { policy } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const policies = usePolicies();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [product, setProduct] = useState<string>(ALL);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return policies.filter(
      (p) =>
        (stage === ALL || p.lifecycleStage === stage) &&
        (product === ALL || p.product === product) &&
        (!term || p.policyId.toLowerCase().includes(term) || p.customerName.toLowerCase().includes(term)),
    );
  }, [policies, q, stage, product]);

  const open = (id: string | undefined) => navigate({ search: (prev) => ({ ...prev, policy: id }) });

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader title="Policies" meta={`${num(rows.length)} of ${num(policies.length)} policies`} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Policy number or customer"
            aria-label="Filter by policy number or customer"
            className="h-8 w-full rounded-input border border-border bg-surface-translucent pl-8 pr-2 text-[13px] focus:border-primary focus:outline-none"
          />
        </div>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger aria-label="Stage" className="h-8 w-[170px] rounded-input text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger aria-label="Product" className="h-8 w-[150px] rounded-input text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All products</SelectItem>
            {PRODUCTS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <PolicyTable policies={rows} onOpen={(id) => open(id)} emptyTitle="No policies match these filters." />
      <PolicyDrawer policyId={policy ?? null} onClose={() => open(undefined)} />
    </div>
  );
}
