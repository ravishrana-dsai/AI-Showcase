export const dynamic = 'force-dynamic';

import { requirePermission, getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CareerPageConfigForm } from "@/components/settings/career-page-config-form";
import { getCareersPublicSiteBase } from "@/lib/careers-site-url";
import { notFound } from "next/navigation";

export const metadata = { title: "Career Page Settings" };

export default async function CareerPageSettingsPage() {
  await requirePermission("settings.manage");

  const session = await getSession();
  const user = session!.user as { organizationId?: string };

  if (!user.organizationId) return notFound();

  const [org, config] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true, slug: true },
    }),
    prisma.careerPageConfig.findUnique({
      where: { organizationId: user.organizationId },
    }),
  ]);

  if (!org) return notFound();

  const careerUrl = `${getCareersPublicSiteBase()}/${org.slug}`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
          <h1 className="text-2xl font-bold">Career Page</h1>
          <p className="text-muted-foreground mt-1">
            Customize your public careers site for {org.name}.
          </p>
        </div>
        <a
          href={careerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
          Preview site
        </a>
      </div>

      <CareerPageConfigForm
        initial={config}
        orgSlug={org.slug}
        orgName={org.name}
        careersPublicBaseUrl={getCareersPublicSiteBase()}
      />
    </div>
  );
}
