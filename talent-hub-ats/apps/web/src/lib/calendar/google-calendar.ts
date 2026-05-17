/**
 * Google Calendar API wrapper.
 * Uses @googleapis/calendar to create, update, and delete calendar events.
 * Handles token refresh automatically.
 */
import { google } from "googleapis";

export interface CalendarTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt?: Date | null;
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmails: string[];
  meetingLink?: string;
  calendarId?: string;
}

export interface RefreshedTokens {
  accessToken: string;
  tokenExpiresAt: Date;
}

function buildOAuthClient(tokens: CalendarTokens) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  );
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.tokenExpiresAt?.getTime(),
  });
  return client;
}

/**
 * Refresh the access token and return the new credentials.
 */
export async function refreshTokens(
  refreshToken: string
): Promise<RefreshedTokens> {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google Calendar access token.");
  }

  return {
    accessToken: credentials.access_token,
    tokenExpiresAt: new Date(credentials.expiry_date ?? Date.now() + 3600 * 1000),
  };
}

/**
 * Create a Google Calendar event.
 * Returns the created event ID.
 */
export async function createEvent(
  tokens: CalendarTokens,
  input: CalendarEventInput
): Promise<string> {
  const auth = buildOAuthClient(tokens);
  const calendar = google.calendar({ version: "v3", auth });

  const event = await calendar.events.insert({
    calendarId: input.calendarId ?? "primary",
    requestBody: {
      summary: input.title,
      description: input.description ?? "",
      start: { dateTime: input.startTime.toISOString() },
      end: { dateTime: input.endTime.toISOString() },
      attendees: input.attendeeEmails.map((email) => ({ email })),
      ...(input.meetingLink
        ? {
            conferenceData: {
              createRequest: { requestId: Math.random().toString(36).slice(2) },
            },
          }
        : {}),
    },
    conferenceDataVersion: input.meetingLink ? 1 : 0,
    sendUpdates: "all",
  });

  return event.data.id ?? "";
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateEvent(
  tokens: CalendarTokens,
  eventId: string,
  input: Partial<CalendarEventInput> & { calendarId?: string }
): Promise<void> {
  const auth = buildOAuthClient(tokens);
  const calendar = google.calendar({ version: "v3", auth });

  const patch: Record<string, unknown> = {};
  if (input.title) patch.summary = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.startTime) patch.start = { dateTime: input.startTime.toISOString() };
  if (input.endTime) patch.end = { dateTime: input.endTime.toISOString() };
  if (input.attendeeEmails) {
    patch.attendees = input.attendeeEmails.map((email) => ({ email }));
  }

  await calendar.events.patch({
    calendarId: input.calendarId ?? "primary",
    eventId,
    requestBody: patch,
    sendUpdates: "all",
  });
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteEvent(
  tokens: CalendarTokens,
  eventId: string,
  calendarId?: string
): Promise<void> {
  const auth = buildOAuthClient(tokens);
  const calendar = google.calendar({ version: "v3", auth });

  await calendar.events.delete({
    calendarId: calendarId ?? "primary",
    eventId,
    sendUpdates: "all",
  });
}
