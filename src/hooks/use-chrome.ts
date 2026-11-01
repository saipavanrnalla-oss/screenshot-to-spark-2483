import { useRouterState } from "@tanstack/react-router";
import { chromeVisible, moduleVisible, overrideFromSearch, type ChromeFlag, type ModuleId } from "@/config/modules";

/** True when `?modules=all` is on the URL. */
export function useModulesOverride(): boolean {
  return useRouterState({ select: (s) => overrideFromSearch(s.location.search) });
}

/** Whether an old banner, badge or panel is shown (CHROME flags in config/modules.ts). */
export function useChrome(flag: ChromeFlag): boolean {
  return chromeVisible(flag, useModulesOverride());
}

/** Whether links into a module are shown. */
export function useModuleVisible(id: ModuleId): boolean {
  return moduleVisible(id, useModulesOverride());
}
