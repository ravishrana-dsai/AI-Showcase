import { withClient } from "../db/client";
import type {
  ClassifiedEntity,
  ClassifiedTask,
  ClassifiedContent,
  ClassifiedOneOnOne,
} from "./classifier";

const FUNCTION_NAME_MAP: Record<string, string> = {
  hrbp: "hrbp",
  generic: "generic",
};

async function getOrCreateFunctionId(
  client: import("pg").PoolClient,
  functionType: string
): Promise<number | null> {
  const name = FUNCTION_NAME_MAP[functionType] ?? "generic";
  const ins = await client.query(
    `INSERT INTO functions (name, config) VALUES ($1, '{}')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name]
  );
  return ins.rows[0]?.id ?? null;
}

export async function storeEntities(
  rawMessageId: number,
  functionType: string,
  entities: ClassifiedEntity[]
): Promise<void> {
  await withClient(async (client) => {
    const functionId = await getOrCreateFunctionId(client, functionType);

    for (const entity of entities) {
      if (entity.type === "task") {
        const e = entity as ClassifiedTask;
        await client.query(
          `INSERT INTO tasks (raw_message_id, function_id, title, assignee_slack_id, due_date, status)
           VALUES ($1, $2, $3, $4, $5, 'open')`,
          [
            rawMessageId,
            functionId,
            e.title,
            e.assigneeSlackId ?? null,
            e.dueDate ?? null,
          ]
        );
      } else if (entity.type === "content") {
        const e = entity as ClassifiedContent;
        await client.query(
          `INSERT INTO content (raw_message_id, function_id, title, content_type, body, tags)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            rawMessageId,
            functionId,
            e.title ?? null,
            e.contentType,
            e.body,
            e.tags ?? [],
          ]
        );
      } else if (entity.type === "one_on_one") {
        const e = entity as ClassifiedOneOnOne;
        const meetingDate = e.meetingDate
          ? (e.meetingDate.includes("/")
              ? new Date(e.meetingDate).toISOString().slice(0, 10)
              : e.meetingDate.slice(0, 10))
          : null;
        const noteRes = await client.query(
          `INSERT INTO one_on_one_notes (raw_message_id, function_id, employee_slack_id, employee_identifier, meeting_date)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            rawMessageId,
            functionId,
            e.employeeSlackId ?? null,
            e.employeeIdentifier ?? null,
            meetingDate,
          ]
        );
        const noteId = noteRes.rows[0]?.id as number;

        for (const issue of e.issues) {
          await client.query(
            `INSERT INTO issues (one_on_one_note_id, raw_message_id, function_id, description)
             VALUES ($1, $2, $3, $4)`,
            [noteId, rawMessageId, functionId, issue]
          );
        }
        for (const ai of e.actionItems) {
          const due = ai.due
            ? (ai.due.includes("/")
                ? new Date(ai.due).toISOString().slice(0, 10)
                : ai.due.slice(0, 10))
            : null;
          // Skip if an identical description already exists for this note
          await client.query(
            `INSERT INTO action_items (one_on_one_note_id, raw_message_id, function_id, description, assignee_slack_id, due_date, status)
             SELECT $1, $2, $3, $4, $5, $6, 'open'
             WHERE NOT EXISTS (
               SELECT 1 FROM action_items
               WHERE one_on_one_note_id = $1
                 AND lower(description) = lower($4)
             )`,
            [noteId, rawMessageId, functionId, ai.description, ai.assignee ?? null, due]
          );
        }
      }
    }
  });
}
