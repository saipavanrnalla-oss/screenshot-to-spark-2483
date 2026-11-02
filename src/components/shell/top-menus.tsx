import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, CircleHelp, CircleUser } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { userById } from "@/config/users";
import { useNotices } from "@/components/r1/notices";
import { resetAllWork } from "@/store/work";
import { useSession, type Theme } from "@/store/session";

const iconButton = "relative inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-translucent hover:text-foreground";

export function NotificationBell() {
  const notices = useNotices();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={iconButton} aria-label={`Notifications, ${notices.length} new`}>
          <Bell className="size-4" />
          {notices.length > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular">
              {notices.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-card border-border bg-popover p-0">
        <p className="border-b border-border px-4 py-2.5 text-[13px] font-semibold text-foreground">Notifications</p>
        {notices.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-muted-foreground">Nothing new.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {notices.map((n) => (
              <li key={n.id}>
                <Link
                  to={n.to as "/persistency/data"}
                  params={n.params as never}
                  search={(n.search ?? {}) as never}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-foreground hover:bg-surface-translucent"
                >
                  <span className={`size-2 shrink-0 rounded-full ${n.tone === "off" ? "bg-failed" : n.tone === "risk" ? "bg-attention" : "bg-simulated"}`} aria-hidden />
                  {n.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

const SHORTCUTS: [string, string][] = [
  ["/", "Search a policy number"],
  ["Esc", "Close a panel or dialog"],
  ["Enter", "Open the selected row"],
];

const PRECEDENCE = [
  "Guardrails",
  "Insurer defaults",
  "The rule that matches the most dimensions",
  "The lower priority number",
];

export function HelpMenu() {
  const [dialog, setDialog] = useState<"keys" | "order" | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={iconButton} aria-label="Help">
            <CircleHelp className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-card border-border bg-popover">
          <DropdownMenuItem onSelect={() => setDialog("keys")}>Keyboard shortcuts</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("order")}>Order of precedence</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm rounded-card border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-semibold">{dialog === "keys" ? "Keyboard shortcuts" : "Order of precedence"}</DialogTitle>
          </DialogHeader>
          {dialog === "keys" ? (
            <ul className="space-y-2">
              {SHORTCUTS.map(([k, d]) => (
                <li key={k} className="flex items-center justify-between text-[13px]">
                  <span className="text-subtle">{d}</span>
                  <kbd className="rounded border border-border px-1.5 text-[12px] text-foreground">{k}</kbd>
                </li>
              ))}
            </ul>
          ) : (
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-subtle">
              {PRECEDENCE.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UserMenu() {
  const navigate = useNavigate();
  const user = userById(useSession((s) => s.userId));
  const theme = useSession((s) => s.theme);
  const setTheme = useSession((s) => s.setTheme);
  const signOut = useSession((s) => s.signOut);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={`${iconButton} w-auto gap-2 px-2`} aria-label="User menu">
            <CircleUser className="size-4" />
            <span className="hidden text-[13px] font-medium text-foreground lg:inline">{user?.name}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-card border-border bg-popover">
          <DropdownMenuLabel className="font-normal">
            <p className="text-[13px] font-semibold text-foreground">{user?.name}</p>
            <p className="text-[12px] text-muted-foreground">
              {user?.role} · {user?.scope}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate({ to: "/login" })}>Switch user</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="rounded-card border-border bg-popover">
              <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => setConfirmReset(true)}>Reset sample data</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              signOut();
              navigate({ to: "/login" });
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent className="rounded-card border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-semibold">Reset sample data?</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px]">
              Created rules, edited agents, imported files and approvals are cleared and the sample data is loaded again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetAllWork();
                toast.success("Sample data reset");
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
