export const dynamic = 'force-dynamic';

import { requirePermission } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import Link from "next/link";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationSettingsPage() {
  const user = await requirePermission("settings.manage");

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      website: true,
      industry: true,
      size: true,
    },
  });

  if (!org) {
    return (
      <div className="max-w-2xl space-y-6">
        <p className="text-destructive">Organization not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Settings
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Organization</h1>
        <p className="text-muted-foreground mt-1">
          Company name, logo, and general settings
        </p>
      </div>
      <OrganizationForm
        initial={{
          name: org.name,
          slug: org.slug,
          website: org.website ?? "",
          industry: org.industry ?? "",
          size: org.size ?? "",
        }}
      />
    </div>
  );
}
