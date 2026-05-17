export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { InterviewsPageClient } from "@/components/interviews/interviews-page-client";
import { getOrgHideDemoData, demoFilterWhere } from "@/lib/demo-data";
import { applicationJobFilterForUser } from "@/lib/sub-recruiter-filter";

export default async function InterviewsPage() {
  const user = await requireAuth();
  const hideDemo = await getOrgHideDemoData(user.organizationId);
  const demoWhere = demoFilterWhere(hideDemo);

  const subRecFilter = await applicationJobFilterForUser(user);
  // Merge the application.job filter from sub-recruiter scoping with the base org filter
  const appJobFilter = (subRecFilter as Record<string, any>)?.application?.job ?? {};

  const allInterviews = await prisma.interview.findMany({
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
          candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
          job: { select: { title: true } },
        },
      },
      panelists: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      scorecards: {
        select: { reviewerId: true, overallRating: true, recommendation: true, submittedAt: true },
      },
    },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });

  const now = new Date();
  const upcoming = allInterviews.filter(
    (i) => ["SCHEDULED", "CONFIRMED"].includes(i.status) && new Date(i.scheduledAt) >= now
  );
  const past = allInterviews.filter(
    (i) => !["SCHEDULED", "CONFIRMED"].includes(i.status) || new Date(i.scheduledAt) < now
  );
  upcoming.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const serialize = (list: typeof allInterviews) =>
    list.map((i) => ({
      ...i,
      scheduledAt: i.scheduledAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      cancelledAt: i.cancelledAt?.toISOString() ?? null,
      scorecards: i.scorecards.map((s) => ({
        ...s,
        submittedAt: s.submittedAt.toISOString(),
      })),
    }));

  const canSchedule = !["HIRING_MANAGER", "INTERVIEWER", "LIMITED"].includes(user.role);

  return (
    <InterviewsPageClient
      upcoming={serialize(upcoming)}
      past={serialize(past)}
      canSchedule={canSchedule}
    />
  );
}
