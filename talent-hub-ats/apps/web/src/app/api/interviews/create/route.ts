import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { fireWebhooks } from "@/lib/webhooks";
import { syncInterviewToCalendar } from "@/lib/calendar/calendar-service";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      applicationId,
      title,
      type = "VIDEO",
      scheduledAt,
      durationMinutes = 60,
      meetingLink,
      location,
      notes,
      timezone,
      panelistIds = [],
      skipCalendarSync = false,
    } = body;

    if (!applicationId || !title || !scheduledAt) {
      return NextResponse.json(
        { error: "applicationId, title, and scheduledAt are required" },
        { status: 400 }
      );
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { candidate: true, job: true },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const validTypes = ["VIDEO", "PHONE", "IN_PERSON", "TAKE_HOME"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be VIDEO, PHONE, IN_PERSON, or TAKE_HOME" },
        { status: 400 }
      );
    }

    const interview = await prisma.interview.create({
      data: {
        applicationId,
        title,
        type,
        scheduledAt: new Date(scheduledAt),
        durationMinutes: durationMinutes ?? 60,
        meetingLink: meetingLink?.trim() || null,
        location: location?.trim() || null,
        notes: notes?.trim() || null,
        timezone: timezone?.trim() || "UTC",
      },
    });

    // Create InterviewPanelist records
    if (panelistIds.length > 0) {
      for (const userId of panelistIds) {
        try {
          await prisma.interviewPanelist.create({
            data: { interviewId: interview.id, userId, role: "Interviewer" },
          });
        } catch {
          // Skip duplicates
        }
      }
    }

    // Fire calendar sync only when explicitly requested (non-blocking)
    if (!skipCalendarSync) {
      syncInterviewToCalendar(interview.id, "create").catch((e) =>
        console.error("Calendar sync failed (create):", e)
      );
    }

    // Create Notification for each panelist
    const candidateName = `${application.candidate.firstName} ${application.candidate.lastName}`;
    const jobTitle = application.job.title;
    const notificationData = panelistIds.map((userId: string) => ({
      userId,
      type: "INTERVIEW_SCHEDULED",
      title: "Interview Scheduled",
      message: `You have been scheduled for an interview with ${candidateName} for ${jobTitle}`,
      link: `/dashboard/interviews/${interview.id}`,
    }));

    if (notificationData.length > 0) {
      await prisma.notification.createMany({
        data: notificationData,
      });
    }

    const orgId = application.job?.organizationId;
    if (orgId) {
      fireWebhooks(orgId, "interview.scheduled", {
        interviewId: interview.id,
        applicationId,
        candidateId: application.candidateId,
        jobId: application.jobId,
        title: interview.title,
        scheduledAt: interview.scheduledAt.toISOString(),
        type: interview.type,
      }).catch((e) => console.error("Webhook fire error:", e));
    }

    const createdInterview = await prisma.interview.findUnique({
      where: { id: interview.id },
      include: {
        panelists: { include: { user: true } },
        application: { include: { candidate: true, job: true } },
      },
    });

    return NextResponse.json(createdInterview, { status: 201 });
  } catch (error) {
    console.error("Create interview error:", error);
    return NextResponse.json(
      { error: "Failed to create interview" },
      { status: 500 }
    );
  }
}
