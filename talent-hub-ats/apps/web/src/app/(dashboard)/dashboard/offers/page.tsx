export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { OffersList } from "@/components/offers/offers-list";
import { getOrgHideDemoData, demoFilterWhere } from "@/lib/demo-data";
import { applicationJobFilterForUser } from "@/lib/sub-recruiter-filter";

export default async function OffersPage() {
  const user = await requireAuth();
  const hideDemo = await getOrgHideDemoData(user.organizationId);
  const demoWhere = demoFilterWhere(hideDemo);

  const subRecFilter = await applicationJobFilterForUser(user);
  // Merge the application.job filter from sub-recruiter scoping with the base org filter
  const appJobFilter = (subRecFilter as Record<string, any>)?.application?.job ?? {};

  const offers = await prisma.offer.findMany({
    where: {
      ...demoWhere,
      application: {
        job: {
          organizationId: user.organizationId,
          ...appJobFilter,
        },
      },
    },
    include: {
      application: {
        include: {
          candidate: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          job: { select: { title: true } },
          stageHistory: {
            include: { stage: { select: { name: true } } },
            orderBy: { enteredAt: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const serialized = offers.map((o) => ({
    id: o.id,
    status: o.status,
    title: o.title,
    createdAt: o.createdAt.toISOString(),
    application: {
      candidate: o.application.candidate,
      job: o.application.job,
      stageHistory: o.application.stageHistory.map((sh) => ({
        id: sh.id,
        stageId: sh.stageId,
        enteredAt: sh.enteredAt.toISOString(),
        exitedAt: sh.exitedAt?.toISOString() ?? null,
        stage: sh.stage,
      })),
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Offers</h1>
        <p className="text-muted-foreground mt-1">
          Track and manage candidate offers
        </p>
      </div>
      <OffersList offers={serialized} />
    </div>
  );
}
