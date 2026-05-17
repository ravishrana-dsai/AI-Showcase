export const dynamic = 'force-dynamic';

import { requirePermission } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import Link from "next/link";
import { TeamMembersClient } from "@/components/settings/team-members-client";

export default async function TeamSettingsPage() {
  const user = await requirePermission("settings.manage");

  const members = await prisma.user.findMany({
    where: { organizationId: user.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      isActive: true,
      lastLoginAt: true,
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  // Serialize dates for the client component
  const serializedMembers = members.map((member) => ({
    ...member,
    lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to Settings
      </Link>

      <TeamMembersClient
        initialMembers={serializedMembers}
        currentUserId={user.id}
        currentUserRole={user.role}
      />
    </div>
  );
}
