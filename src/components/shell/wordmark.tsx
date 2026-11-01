import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Links to /persistency, which sends each user to their landing page. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/persistency" className={cn("text-[16px] font-semibold tracking-tight text-foreground", className)} aria-label="desible.ai home">
      desible<span className="text-primary">.ai</span>
    </Link>
  );
}
