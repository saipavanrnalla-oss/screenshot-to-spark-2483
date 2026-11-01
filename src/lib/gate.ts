import { redirect } from "@tanstack/react-router";
import { MODULES, moduleVisible, overrideFromSearch, type ModuleId } from "@/config/modules";
import { userById, type NavKey, type TestUser } from "@/config/users";
import { useSession } from "@/store/session";
import { NAV_BY_KEY } from "@/components/shell/nav";

export function landingRoute(user: TestUser): string {
  return MODULES[user.landing].route;
}

/** Whether a sidebar entry is visible to this user right now. */
export function navVisible(key: NavKey, user: TestUser | undefined, override: boolean): boolean {
  const entry = NAV_BY_KEY[key];
  if (override) return true;
  if (!user || !user.nav.includes(key)) return false;
  return entry.module === null || moduleVisible(entry.module, false);
}

/** Every /persistency route runs client-side only, so the session can be read here. */
export function requireUser(): TestUser {
  const user = userById(useSession.getState().userId);
  if (!user) throw redirect({ to: "/login" });
  return user;
}

function keepOverride(search: unknown) {
  return overrideFromSearch(search) ? { modules: "all" } : {};
}

/**
 * ModuleGate for route `beforeLoad`: a hidden module, or one the role may not
 * open, redirects to the signed-in user's landing page.
 */
export function gate(key: NavKey, search: unknown) {
  const user = requireUser();
  if (navVisible(key, user, overrideFromSearch(search))) return;
  throw redirect({ to: landingRoute(user) as "/persistency/stages", search: keepOverride(search) as never });
}

export function gateModule(id: ModuleId, search: unknown) {
  const key = (Object.keys(NAV_BY_KEY) as NavKey[]).find((k) => NAV_BY_KEY[k].module === id && NAV_BY_KEY[k].route === MODULES[id].route);
  if (key) gate(key, search);
}
