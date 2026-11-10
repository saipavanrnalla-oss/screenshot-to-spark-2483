import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaySearch {
  amount?: string | undefined;
  plan?: string | undefined;
  name?: string | undefined;
  step?: string | undefined;
}

/**
 * Demo payment page the WhatsApp link opens on the visitor's phone. Pressing Pay reports a payment to
 * /api/live/result, and the board moves the policy on. No money moves: there is no gateway behind it.
 */
export const Route = createFileRoute("/pay/$policy")({
  validateSearch: (s: Record<string, unknown>): PaySearch => ({
    amount: typeof s["amount"] === "string" ? s["amount"] : undefined,
    plan: typeof s["plan"] === "string" ? s["plan"] : undefined,
    name: typeof s["name"] === "string" ? s["name"] : undefined,
    step: typeof s["step"] === "string" ? s["step"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Pay your premium · Sample Life Insurance" }, { name: "robots", content: "noindex" }] }),
  component: PayPage,
});

function PayPage() {
  const { policy } = Route.useParams();
  const q = Route.useSearch();
  const [state, setState] = useState<"ready" | "paying" | "paid" | "error">("ready");

  const pay = async () => {
    setState("paying");
    try {
      const res = await fetch("/api/live/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy, channel: "WhatsApp", step: q.step, paid: true, delivered: true, read: true, disposition: "Paid on the link" }),
      });
      setState(res.ok ? "paid" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-[380px] space-y-4 rounded-card border border-border bg-card p-5">
        <header>
          <p className="text-[13px] font-semibold text-foreground">Sample Life Insurance</p>
          <p className="text-[12px] text-muted-foreground">Renewal premium payment</p>
        </header>
        {state === "paid" ? (
          <div className="space-y-2 py-6 text-center">
            <CheckCircle2 className="mx-auto size-10 text-healthy" aria-hidden />
            <p className="text-[16px] font-semibold text-foreground">Payment received</p>
            <p className="text-[13px] text-muted-foreground">Your policy {policy} stays in force. A receipt is on its way on WhatsApp.</p>
          </div>
        ) : (
          <>
            <dl className="space-y-2 text-[13px]">
              {q.name && <Row k="Policyholder" v={q.name} />}
              <Row k="Policy" v={policy} />
              {q.plan && <Row k="Plan" v={q.plan} />}
              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Premium due</dt>
                <dd className="text-[20px] font-semibold text-foreground">{q.amount ? `Rs ${q.amount}` : "As per your notice"}</dd>
              </div>
            </dl>
            <Button className="w-full" onClick={pay} disabled={state === "paying"}>{state === "paying" ? "Paying" : "Pay by UPI"}</Button>
            {state === "error" && <p className="text-[12px] text-failed">The payment could not be recorded. Please try again.</p>}
            <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Lock className="size-3" aria-hidden /> Demo payment page. No money is taken.</p>
          </>
        )}
      </section>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right text-foreground">{v}</dd>
    </div>
  );
}
