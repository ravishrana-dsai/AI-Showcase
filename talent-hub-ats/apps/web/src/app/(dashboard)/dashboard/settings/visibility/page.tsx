export const dynamic = 'force-dynamic';

import { requirePermission } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import Link from "next/link";
import { VisibilityConfigForm } from "@/components/settings/visibility-config-form";
import { mergeVisibilityConfig } from "@/lib/visibility";

export default async function VisibilitySettingsPage() {
  const user = await requirePermission("settings.visibility");

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });

  const rawConfig = org?.visibilityConfig;
  const stored =
    rawConfig !== null &&
    rawConfig !== undefined &&
    typeof rawConfig === "object"
      ? (rawConfig as Record<string, Record<string, boolean>>)
      : {};

  const mergedConfig = mergeVisibilityConfig(stored);

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Back to Settings
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Field Visibility Settings</h1>
        <p className="text-muted-foreground mt-1">
          Control which candidate profile fields each role can see.
          Use the toggles to show or hide fields per role.
        </p>
      </div>

      <div className="bg-card rounded-xl border p-6">
        <VisibilityConfigForm initialConfig={mergedConfig} userRole={user.role} />
      </div>
    </div>
  );
}
