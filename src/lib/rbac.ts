import { Role } from "@/generated/prisma/client";
import { modules, type ModuleKey } from "@/lib/modules";

/**
 * Role-based access control — the single source of truth for which
 * modules each role may see and reach.
 *
 * ADMIN and MANAGER get the full portal. B2B_SALON partners are
 * restricted to Overview + Orders. This map is consulted in BOTH places
 * that matter: the sidebar (to hide what a role can't use) and the
 * server-side route guard (so hiding alone is never the only defence).
 */
const MODULE_ACCESS: Record<Role, readonly ModuleKey[]> = {
  [Role.ADMIN]: modules.map((m) => m.key),
  [Role.MANAGER]: modules.map((m) => m.key),
  [Role.B2B_SALON]: ["overview", "orders"],
};

/** Modules a role is allowed to access, in canonical nav order. */
export function allowedModules(role: Role): readonly ModuleKey[] {
  const allowed = new Set(MODULE_ACCESS[role]);
  return modules.map((m) => m.key).filter((key) => allowed.has(key));
}

/** Whether a role may access a specific module. */
export function canAccessModule(role: Role, moduleKey: ModuleKey): boolean {
  return MODULE_ACCESS[role].includes(moduleKey);
}
