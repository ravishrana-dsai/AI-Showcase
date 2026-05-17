import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { PERMISSIONS, type Permission } from "@talent-hub/shared";
import type { SessionUser } from "@talent-hub/shared";

/**
 * Get the current session on the server side.
 * Redirects to login if not authenticated.
 */
export async function requireAuth(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return session.user as SessionUser;
}

/**
 * Get the current session without redirecting.
 */
export async function getSession() {
  return getServerSession(authOptions);
}

/**
 * Check if the current user has a specific permission.
 */
export function hasPermission(
  userRole: string,
  permission: Permission
): boolean {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return (allowedRoles as readonly string[]).includes(userRole);
}

/**
 * Require a specific permission, redirect to unauthorized if not allowed.
 */
export async function requirePermission(permission: Permission) {
  const user = await requireAuth();
  if (!hasPermission(user.role, permission)) {
    redirect("/unauthorized");
  }
  return user;
}
