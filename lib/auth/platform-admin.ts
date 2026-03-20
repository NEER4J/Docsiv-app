import type { User } from "@supabase/supabase-js";

/** True when Supabase Auth user_metadata.platform_admin is set (staff; RPCs re-check server-side). */
export function isPlatformAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const raw = user.user_metadata as Record<string, unknown> | undefined;
  const v = raw?.platform_admin;
  return v === true || v === "true" || v === "t" || v === "1" || v === 1;
}
