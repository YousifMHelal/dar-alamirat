import { redirect } from "next/navigation";
import type { ModuleKey } from "@/lib/modules";
import { canAccessModule } from "@/lib/rbac";
import { getCurrentUser } from "./session";

/**
 * Server-side RBAC guard for a module route. Call this at the top of every
 * module page's Server Component — it is the *enforcing* half of RBAC
 * (hiding sidebar items is only cosmetic).
 *
 * - No session → /login (defence-in-depth; middleware already gates this).
 * - Session but role lacks the module → /overview (a module every role can
 *   reach), so typing a forbidden URL directly is blocked.
 *
 * Returns the current user so the page can use it without a second lookup.
 */
export async function requireModuleAccess(moduleKey: ModuleKey, locale: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!canAccessModule(user.role, moduleKey)) {
    redirect(`/${locale}/overview`);
  }
  return user;
}
