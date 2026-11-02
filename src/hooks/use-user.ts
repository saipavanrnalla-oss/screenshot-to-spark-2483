import { can, userById, type Permission, type TestUser } from "@/config/users";
import { useSession } from "@/store/session";

export function useUser(): TestUser | undefined {
  return userById(useSession((s) => s.userId));
}

export function useCan(permission: Permission): boolean {
  return can(useUser(), permission);
}
