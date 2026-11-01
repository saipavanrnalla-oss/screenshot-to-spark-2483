import { describe, expect, it } from "vitest";
import { CHROME, MODULES } from "@/config/modules";
import { USERS, userById, type NavKey } from "@/config/users";
import { NAV } from "@/components/shell/nav";
import { navVisible } from "@/lib/gate";
import { VENDORS, WORKFLOWS } from "@/data/persistency";

const visibleFor = (id: string, override = false) => NAV.filter((n) => navVisible(n.key, userById(id), override)).map((n) => n.key);

describe("Release 1 visibility", () => {
  it("hides Cohorts, Work queues, Collections, Contact policy, Administration, Overview and Where Desible sits", () => {
    const hidden = (Object.keys(MODULES) as (keyof typeof MODULES)[]).filter((k) => !MODULES[k].enabled).sort();
    expect(hidden).toEqual(["admin", "cohorts", "collections", "guardrails", "overview", "positioning", "roles"]);
  });

  it("turns every old banner, badge, ticker and panel off", () => {
    expect(Object.values(CHROME).every((v) => v === false)).toBe(true);
  });

  it("shows each role exactly the sidebar items in the brief", () => {
    const full: NavKey[] = ["stages", "policies", "approvals", "rules", "workflows", "agents", "data", "reports"];
    expect(visibleFor("head")).toEqual(full);
    expect(visibleFor("mis")).toEqual(full);
    expect(visibleFor("compliance")).toEqual(full);
    expect(visibleFor("remittance")).toEqual(["stages", "policies", "data"]);
    expect(visibleFor("executive")).toEqual(["stages", "reports"]);
  });

  it("lands each test user on the page in the brief", () => {
    const landing = Object.fromEntries(USERS.map((u) => [u.id, MODULES[u.landing].label]));
    expect(landing).toEqual({
      head: "Policy stages",
      mis: "Data files",
      compliance: "Workflows",
      remittance: "Data files",
      executive: "Reports",
    });
  });

  it("shows every page with ?modules=all", () => {
    expect(visibleFor("executive", true)).toHaveLength(NAV.length);
  });

  it("uses no real vendor names", () => {
    const names = [...VENDORS.map((v) => v.name), ...WORKFLOWS.map((w) => w.executor)].join(" ");
    expect(names).not.toMatch(/Pace Setters|\bATS\b|Paylocal|Ubona/);
  });
});
