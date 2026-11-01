import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/wordmark";
import { MODULES } from "@/config/modules";
import { USERS } from "@/config/users";
import { useSession } from "@/store/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · Persistency · desible.ai" },
      { name: "description", content: "Choose a test user to sign in to Persistency." },
      { property: "og:title", content: "Sign in · Persistency · desible.ai" },
      { property: "og:description", content: "Choose a test user to sign in to Persistency." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const signIn = useSession((s) => s.signIn);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[560px]">
        <div className="mb-6 flex items-center gap-2">
          <Wordmark />
          <span className="text-[13px] text-muted-foreground">Persistency</span>
        </div>
        <section className="panel">
          <header className="border-b border-border px-6 py-4">
            <h1 className="text-[20px] font-semibold text-foreground">Sign in</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">Choose a test user. The user sets the role and what you can see.</p>
          </header>
          <ul className="divide-y divide-border">
            {USERS.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{u.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {u.scope} · lands on {MODULES[u.landing].label}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    signIn(u.id);
                    navigate({ to: MODULES[u.landing].route as "/persistency/stages" });
                  }}
                  aria-label={`Sign in as ${u.name}`}
                >
                  Sign in
                </Button>
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-4 text-center text-[12px] text-muted-foreground">Sample data</p>
      </div>
    </div>
  );
}
