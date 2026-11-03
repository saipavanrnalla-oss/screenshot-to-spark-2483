import { describe, expect, it } from "vitest";
import { CHROME, MODULES } from "@/config/modules";
import { USERS, userById, type NavKey } from "@/config/users";
import { NAV } from "@/components/shell/nav";
import { navVisible } from "@/lib/gate";
import { VENDORS, WORKFLOWS } from "@/data/persistency";

const visibleFor = (id: string, override = false) => NAV.filter((n) => navVisible(n.key, userById(id), override)).map((n) => n.key);

describe("Release 1 visibility", () => {
  it("hides Cohorts, Rules, Work queues, Collections, Data files, Contact policy, Administration, Overview and Where Desible sits", () => {
    const hidden = (Object.keys(MODULES) as (keyof typeof MODULES)[]).filter((k) => !MODULES[k].enabled).sort();
    expect(hidden).toEqual(["admin", "cohorts", "collections", "data", "guardrails", "overview", "positioning", "roles", "rules"]);
  });

  it("turns every old banner, badge, ticker and panel off", () => {
    expect(Object.values(CHROME).every((v) => v === false)).toBe(true);
  });

  it("lists two demo users", () => {
    expect(USERS.map((u) => u.id)).toEqual(["ops", "head"]);
  });

  it("shows each user the sidebar items for the demo", () => {
    expect(visibleFor("ops")).toEqual(["agents", "workflows", "launch", "performance", "activity", "policies", "approvals"]);
    expect(visibleFor("head")).toEqual(["executive", "reports", "workflows", "performance", "policies", "approvals"]);
  });

  it("lands each user on the page for the demo", () => {
    const landing = Object.fromEntries(USERS.map((u) => [u.id, MODULES[u.landing].label]));
    expect(landing).toEqual({ ops: "Agents", head: "Executive dashboard" });
  });

  it("keeps Head of Persistency read-only on workflows", () => {
    const head = userById("head")!;
    expect(head.can).not.toContain("workflows.edit");
    expect(head.readOnly).toContain("workflows");
  });

  it("shows every page with ?modules=all", () => {
    expect(visibleFor("head", true)).toHaveLength(NAV.length);
  });

  it("uses no real vendor names", () => {
    const names = [...VENDORS.map((v) => v.name), ...WORKFLOWS.map((w) => w.executor)].join(" ");
    expect(names).not.toMatch(/Pace Setters|\bATS\b|Paylocal|Ubona/);
  });
});
