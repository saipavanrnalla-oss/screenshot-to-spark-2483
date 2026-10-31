import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("text-[17px] font-extrabold tracking-tight text-foreground", className)} aria-label="desible.ai home">
      desible<span className="text-primary">.ai</span>
    </Link>
  );
}
