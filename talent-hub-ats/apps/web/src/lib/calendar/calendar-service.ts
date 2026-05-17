/**
 * Calendar service: dispatches interview events to Google Calendar
 * using the organizer's stored (encrypted) OAuth tokens.
 */
import { prisma } from "@talent-hub/db";
import { decrypt, encrypt } from "@/lib/crypto";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  refreshTokens,
  type CalendarTokens,
} from "./google-calendar";

async function getValidTokens(integrationId: string): Promise<CalendarTokens & { calendarId?: string }> {
  const integration = await prisma.calendarIntegration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.isActive) {
    throw new Error("Calendar integration not found or inactive.");
  }

  let accessToken = decrypt(integration.accessToken);
  const refreshToken = decrypt(integration.refreshToken);
  let tokenExpiresAt = integration.tokenExpiresAt;

  // Refresh if expired or within 5 minutes of expiry
  const now = Date.now();
  const expiry = tokenExpiresAt?.getTime() ?? 0;
  if (expiry - now < 5 * 60 * 1000) {
    const refreshed = await refreshTokens(refreshToken);
    accessToken = refreshed.accessToken;
    tokenExpiresAt = refreshed.tokenExpiresAt;

    await prisma.calendarIntegration.update({
      where: { id: integrationId },
      data: {
        accessToken: encrypt(refreshed.accessToken),
        tokenExpiresAt: refreshed.tokenExpiresAt,
        needsReauth: false,
      },
    });
  }

  return {
    accessToken,
    refreshToken,
    tokenExpiresAt,
    calendarId: integration.calendarId ?? "primary",
  };
}

async function markNeedsReauth(integrationId: string) {
  await prisma.calendarIntegration.update({
    where: { id: integrationId },
    data: { needsReauth: true },
  });
}

export async function syncInterviewToCalendar(
  interviewId: string,
  action: "create" | "update" | "delete"
): Promise<void> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      application: {
        include: {
          candidate: { select: { firstName: true, lastName: true } },
          job: { select: { title: true } },
        },
      },
      panelists: {
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  if (!interview) return;

  // Find any panelist with an active calendar integration (organizer)
  const organizer = interview.panelists.find((p) => p.user.id !== undefined);
  if (!organizer) return;

  const integration = await prisma.calendarIntegration.findFirst({
    where: { userId: organizer.user.id, isActive: true },
  });

  if (!integration) return;

  const candidateName = `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`;
  const jobTitle = interview.application.job.title;
  const title = `Interview: ${candidateName} for ${jobTitle}`;

  const attendeeEmails = interview.panelists
    .map((p) => p.user.email)
    .filter((e): e is string => !!e);

  const startTime = new Date(interview.scheduledAt);
  const endTime = new Date(startTime.getTime() + (interview.durationMinutes ?? 60) * 60 * 1000);

  try {
    const tokens = await getValidTokens(integration.id);

    if (action === "create") {
      const eventId = await createEvent(tokens, {
        title,
        description: `Type: ${interview.type}\nPanelists: ${attendeeEmails.join(", ")}\n${interview.meetingLink ? `Meeting: ${interview.meetingLink}` : ""}`,
        startTime,
        endTime,
        attendeeEmails,
        meetingLink: interview.meetingLink ?? undefined,
        calendarId: tokens.calendarId,
      });

      await prisma.interview.update({
        where: { id: interviewId },
        data: { calendarEventId: eventId },
      });
    } else if (action === "update" && interview.calendarEventId) {
      await updateEvent(tokens, interview.calendarEventId, {
        title,
        startTime,
        endTime,
        attendeeEmails,
        calendarId: tokens.calendarId,
      });
    } else if (action === "delete" && interview.calendarEventId) {
      await deleteEvent(tokens, interview.calendarEventId, tokens.calendarId);

      await prisma.interview.update({
        where: { id: interviewId },
        data: { calendarEventId: null },
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401") || message.includes("invalid_grant")) {
      await markNeedsReauth(integration.id);
    }
    throw err;
  }
}
