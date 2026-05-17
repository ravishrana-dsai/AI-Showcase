import { query } from "../db/client";

export interface RawMessageRow {
  id: number;
  slack_ts: string;
  channel_id: string;
  user_id: string;
  thread_ts: string | null;
  text: string;
  raw_payload: Record<string, unknown> | null;
  created_at: Date;
}

export interface IngestMessageInput {
  slack_ts: string;
  channel_id: string;
  user_id: string;
  thread_ts?: string | null;
  text: string;
  raw_payload?: Record<string, unknown>;
}

/**
 * Store a raw Slack message. Uses slack_ts as unique key to avoid duplicates.
 * Returns the inserted row or existing row if slack_ts already exists.
 */
export async function ingestMessage(
  input: IngestMessageInput
): Promise<RawMessageRow | null> {
  const { slack_ts, channel_id, user_id, thread_ts, text, raw_payload } = input;
  const payloadJson = raw_payload ? JSON.stringify(raw_payload) : null;

  const { rows } = await query<RawMessageRow>(
    `INSERT INTO raw_messages (slack_ts, channel_id, user_id, thread_ts, text, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (slack_ts) DO UPDATE SET
       text = EXCLUDED.text,
       raw_payload = EXCLUDED.raw_payload
     RETURNING id, slack_ts, channel_id, user_id, thread_ts, text, raw_payload, created_at`,
    [slack_ts, channel_id, user_id, thread_ts ?? null, text, payloadJson]
  );
  return rows[0] ?? null;
}
