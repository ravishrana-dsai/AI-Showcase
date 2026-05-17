export const dynamic = 'force-dynamic';

import { requireAuth } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { Calendar, FileText } from "lucide-react";
import { MyInterviewsClient } from "@/components/interviews/my-interviews-client";
import { getOrgHideDemoData, demoFilterWhere } from "@/lib/demo-data";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function MyInterviewsPage() {
  const user = await requireAuth();

  const now = new Date();
  const hideDemo = await getOrgHideDemoData(user.organizationId);
  const demoWhere = demoFilterWhere(hideDemo);

  const myInterviews = await prisma.interview.findMany({
    where: {
      ...demoWhere,
      panelists: { some: { userId: user.id } },
      application: { job: { organizationId: user.organizationId } },
    },
    include: {
      scorecards: { where: { reviewerId: user.id }, select: { id: true } },
    },
    orderBy: { scheduledAt: "desc" },
  });

  const upcomingCount = myInterviews.filter(
    (i) =>
      ["SCHEDULED", "CONFIRMED"].includes(i.status) && i.scheduledAt >= now
  ).length;
  const feedbackPendingCount = myInterviews.filter(
    (i) =>
      ["COMPLETED", "NO_SHOW"].includes(i.status) &&
      i.scorecards.length === 0
  ).length;

  const firstName = user.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-transparent to-primary/5 p-6">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {getGreeting()}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{firstName}</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Here’s your interview schedule and feedback status. Submit feedback for completed interviews below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{upcomingCount}</p>
              <p className="text-sm font-medium text-muted-foreground">Upcoming interviews</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{feedbackPendingCount}</p>
              <p className="text-sm font-medium text-muted-foreground">Feedback pending</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Your interviews
        </h2>
        <MyInterviewsClient />
      </div>
    </div>
  );
}
