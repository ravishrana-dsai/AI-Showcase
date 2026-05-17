import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getCareersPublicSiteBase } from "@/lib/careers-site-url";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as { organizationId?: string; role?: string };

  const org = sessionUser.organizationId
    ? await prisma.organization.findUnique({
        where: { id: sessionUser.organizationId },
        select: { slug: true },
      })
    : null;

  return (
    <div className="min-h-screen flex bg-muted/30">
      <Sidebar
        user={session.user as any}
        orgSlug={org?.slug}
        careersPublicBaseUrl={getCareersPublicSiteBase()}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={session.user as any} />
        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
