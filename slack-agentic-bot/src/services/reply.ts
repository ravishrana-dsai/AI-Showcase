import type { WebClient } from "@slack/web-api";
import type { KnownBlock, Block } from "@slack/types";
import type { ClassifiedEntity, ClassifiedOneOnOne, ClassifiedTask, ClassifiedContent } from "./classifier";
import { query } from "../db/client";

type SlackBlock = KnownBlock | Block;

interface OpenActionItem {
  employee_identifier: string | null;
  description: string;
  status: string;
}

async function fetchOpenActionItems(): Promise<OpenActionItem[]> {
  const { rows } = await query<OpenActionItem>(
    `SELECT DISTINCT ON (n.employee_identifier, lower(a.description))
       n.employee_identifier,
       a.description,
       a.status
     FROM action_items a
     LEFT JOIN one_on_one_notes n ON a.one_on_one_note_id = n.id
     WHERE a.status = 'open'
     ORDER BY n.employee_identifier, lower(a.description), a.id`
  );
  return rows;
}

function buildThreadReplyBlocks(entities: ClassifiedEntity[]): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Stored", emoji: true },
    },
  ];

  for (const entity of entities) {
    if (entity.type === "one_on_one") {
      const e = entity as ClassifiedOneOnOne;
      const name = e.employeeIdentifier ?? "Unknown Employee";
      const date = e.meetingDate ? ` · ${e.meetingDate}` : "";
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*1:1 Note — ${name}*${date}`,
        },
      });
      if (e.issues.length > 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Issues (${e.issues.length})*\n${e.issues.map((i) => `• ${i}`).join("\n")}`,
          },
        });
      }
      if (e.actionItems.length > 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Action Items (${e.actionItems.length})*\n${e.actionItems.map((a) => `• ${a.description}`).join("\n")}`,
          },
        });
      }
    } else if (entity.type === "task") {
      const e = entity as ClassifiedTask;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Task added*\n• ${e.title}`,
        },
      });
    } else if (entity.type === "content") {
      const e = entity as ClassifiedContent;
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Note stored* _(${e.contentType})_`,
        },
      });
    }
    blocks.push({ type: "divider" });
  }

  return blocks;
}

function buildChannelSummaryBlocks(openItems: OpenActionItem[]): SlackBlock[] {
  if (openItems.length === 0) {
    return [
      {
        type: "section",
        text: { type: "mrkdwn", text: "No open action items at the moment." },
      } as SlackBlock,
    ];
  }

  const byEmployee: Record<string, string[]> = {};
  for (const item of openItems) {
    const key = item.employee_identifier ?? "General";
    if (!byEmployee[key]) byEmployee[key] = [];
    byEmployee[key].push(item.description);
  }

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Open Action Items by Employee", emoji: true },
    },
  ];

  for (const [employee, items] of Object.entries(byEmployee)) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${employee}*\n${items.map((i) => `• ${i}`).join("\n")}`,
      },
    });
    blocks.push({ type: "divider" });
  }

  return blocks;
}

export async function postReply(
  client: WebClient,
  channelId: string,
  threadTs: string,
  entities: ClassifiedEntity[]
): Promise<void> {
  const threadBlocks = buildThreadReplyBlocks(entities);

  await client.chat.postMessage({
    channel: channelId,
    thread_ts: threadTs,
    text: "Stored",
    blocks: threadBlocks,
  });

  const openItems = await fetchOpenActionItems();
  const summaryBlocks = buildChannelSummaryBlocks(openItems);

  await client.chat.postMessage({
    channel: channelId,
    text: "Open Action Items by Employee",
    blocks: summaryBlocks,
  });
}
