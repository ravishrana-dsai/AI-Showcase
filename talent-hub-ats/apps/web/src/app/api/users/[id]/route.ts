import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { USER_ROLES, ROLE_HIERARCHY } from "@talent-hub/shared";
import { hash } from "bcryptjs";

const VALID_ROLES = Object.values(USER_ROLES);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = session.user as {
    id: string;
    role: string;
    organizationId?: string;
  };

  if (!hasPermission(currentUser.role, "users.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const organizationId = currentUser.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: targetUserId } = await params;

  try {
    // Verify the target user belongs to the same org
    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { role, name, title, isActive } = body;

    // Prevent changing own role or deactivating self
    if (targetUserId === currentUser.id) {
      if (role !== undefined && role !== currentUser.role) {
        return NextResponse.json(
          { error: "You cannot change your own role" },
          { status: 400 }
        );
      }
      if (isActive === false) {
        return NextResponse.json(
          { error: "You cannot deactivate yourself" },
          { status: 400 }
        );
      }
    }

    // Validate role if provided
    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    // Prevent non-SUPER_ADMIN from changing SUPER_ADMIN role
    if (targetUser.role === "SUPER_ADMIN" && currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only a Super Admin can modify another Super Admin" },
        { status: 403 }
      );
    }

    // Prevent assigning SUPER_ADMIN role unless current user is SUPER_ADMIN
    if (role === "SUPER_ADMIN" && currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only a Super Admin can assign the Super Admin role" },
        { status: 403 }
      );
    }

    // Prevent lower-ranked users from assigning higher roles
    if (role !== undefined) {
      const currentUserHierarchy = ROLE_HIERARCHY[currentUser.role] ?? 0;
      const newRoleHierarchy = ROLE_HIERARCHY[role] ?? 0;
      if (newRoleHierarchy > currentUserHierarchy) {
        return NextResponse.json(
          { error: "You cannot assign a role higher than your own" },
          { status: 403 }
        );
      }
    }

    // Super Admin can reset another user's password
    const newPassword = body.newPassword as string | undefined;
    if (newPassword !== undefined) {
      if (currentUser.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Only a Super Admin can reset passwords" }, { status: 403 });
      }
      if (currentUser.id === targetUserId) {
        return NextResponse.json({ error: "Use the Account Settings page to change your own password" }, { status: 400 });
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
      }
      const passwordHash = await hash(newPassword, 12);
      await prisma.user.update({ where: { id: targetUserId }, data: { passwordHash } });
      return NextResponse.json({ success: true });
    }

    // Build the update data immutably
    const updateData: Record<string, unknown> = {};
    if (role !== undefined) updateData.role = role;
    if (name !== undefined) updateData.name = name.trim();
    if (title !== undefined) updateData.title = title?.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        title: true,
        isActive: true,
        lastLoginAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}
