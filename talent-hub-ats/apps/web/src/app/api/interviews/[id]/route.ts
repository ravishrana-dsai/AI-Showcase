import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { syncInterviewToCalendar } from "@/lib/calendar/calendar-service";


export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      panelists: {
        include: { user: { select: { id: true, name: true, email: true, title: true, role: true } } },
      },
      scorecards: {
        include: {
          reviewer: { select: { id: true, name: true, title: true } },
        },
        orderBy: { submittedAt: "desc" },
      },
      application: {
        include: {
          candidate: {
            select: { id: true, firstName: true, lastName: true, email: true, currentTitle: true, currentCompany: true },
          },
          job: { select: { id: true, title: true, status: true } },
          currentStage: { select: { name: true } },
        },
      },
    },
  });

  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  return NextResponse.json(interview);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, cancelReason } = body;

  const validStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (status === "CANCELLED") {
    updateData.cancelledAt = new Date();
    updateData.cancelReason = cancelReason || null;
  }

  const updated = await prisma.interview.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      status: true,
      cancelledAt: true,
      cancelReason: true,
      calendarEventId: true,
    },
  });

  // Only sync to calendar if this interview was originally created with Google Calendar
  if (updated.calendarEventId) {
    const calendarAction = status === "CANCELLED" ? "delete" : "update";
    syncInterviewToCalendar(id, calendarAction).catch((e) =>
      console.error(`Calendar sync failed (${calendarAction}):`, e)
    );
  }

  return NextResponse.json(updated);
}
