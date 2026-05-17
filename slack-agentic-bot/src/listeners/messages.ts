import type { GenericMessageEvent, SlackEvent } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import { ingestMessage } from "../services/ingestion";
import { classify } from "../services/classifier";
import { storeEntities } from "../services/storage";
import { postReply } from "../services/reply";
import { publishHome } from "../services/home";

function isMessageEvent(event: SlackEvent): event is GenericMessageEvent {
  return event.type === "message" && "text" in event;
}

function shouldIgnoreMessage(message: GenericMessageEvent): boolean {
  if (!message.text) return true;
  if ("bot_id" in message && message.bot_id) return true;
  if ("subtype" in message && message.subtype) {
    const ignore = ["message_changed", "message_deleted", "bot_message"];
    if (ignore.includes(message.subtype)) return true;
  }
  return false;
}

export async function handleMessage(
  event: SlackEvent,
  client: WebClient
): Promise<void> {
  if (!isMessageEvent(event)) return;
  if (shouldIgnoreMessage(event)) return;

  const channelId = event.channel;
  const user = "user" in event ? event.user : undefined;
  const ts = event.ts;
  const threadTs = "thread_ts" in event ? event.thread_ts : undefined;
  const text = event.text ?? "";

  if (!user || !ts) return;

  const raw = await ingestMessage({
    slack_ts: ts,
    channel_id: channelId,
    user_id: user,
    thread_ts: threadTs,
    text,
    raw_payload: event as unknown as Record<string, unknown>,
  });

  if (!raw) return;

  const { functionType, entities } = classify({
    text,
    channelId,
    userId: user,
  });

  await storeEntities(raw.id, functionType, entities);
  console.log(
    `Stored message ${ts} (raw id ${raw.id}) → ${entities.length} entity/entities`
  );

  await postReply(client, channelId, ts, entities);

  // Refresh the Home tab for the sender so it reflects the new data immediately
  await publishHome(client, user).catch((err) =>
    console.warn("Home tab update failed:", err?.message)
  );
}
