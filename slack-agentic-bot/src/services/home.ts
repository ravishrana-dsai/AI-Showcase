import type { WebClient } from "@slack/web-api";
import type { KnownBlock, Block } from "@slack/types";
import { query } from "../db/client";

type SlackBlock = KnownBlock | Block;

interface EmployeeNote {
  note_id: number;
  employee_identifier: string | null;
  meeting_date: string | null;
  raw_message_id: number;
  created_at: Date;
}

interface NoteIssue {
  note_id: number;
  description: string;
}

interface NoteAction {
  note_id: number;
  description: string;
  status: string;
  due_date: string | null;
}

interface StandaloneTask {
  title: string;
  status: string;
  due_date: string | null;
  created_at: Date;
}

async function fetchAllData() {
  const [notesRes, issuesRes, actionsRes, tasksRes] = await Promise.all([
    query<EmployeeNote>(
      `SELECT id as note_id, employee_identifier, meeting_date, raw_message_id, created_at
       FROM one_on_one_notes
       ORDER BY employee_identifier, created_at DESC`
    ),
    query<NoteIssue>(
      `SELECT one_on_one_note_id as note_id, description FROM issues ORDER BY id`
    ),
    query<NoteAction>(
      `SELECT one_on_one_note_id as note_id, description, status, due_date
       FROM action_items ORDER BY id`
    ),
    query<StandaloneTask>(
      `SELECT title, status, due_date, created_at FROM tasks ORDER BY created_at DESC`
    ),
  ]);
  return {
    notes: notesRes.rows,
    issues: issuesRes.rows,
    actions: actionsRes.rows,
    tasks: tasksRes.rows,
  };
}

function buildHomeBlocks(
  notes: EmployeeNote[],
  issues: NoteIssue[],
  actions: NoteAction[],
  tasks: StandaloneTask[]
): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "HR Dashboard", emoji: true },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Last updated: <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|now>`,
        },
      ],
    },
    { type: "divider" },
  ];

  if (notes.length === 0 && tasks.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_No employee notes yet. Start sending messages in your channel._",
      },
    });
    return blocks;
  }

  // Group notes by employee
  const byEmployee = new Map<string, EmployeeNote[]>();
  for (const note of notes) {
    const key = note.employee_identifier ?? "General";
    if (!byEmployee.has(key)) byEmployee.set(key, []);
    byEmployee.get(key)!.push(note);
  }

  // Index issues and actions by note_id
  const issuesByNote = new Map<number, string[]>();
  for (const i of issues) {
    if (!issuesByNote.has(i.note_id)) issuesByNote.set(i.note_id, []);
    issuesByNote.get(i.note_id)!.push(i.description);
  }

  const actionsByNote = new Map<number, NoteAction[]>();
  for (const a of actions) {
    if (!actionsByNote.has(a.note_id)) actionsByNote.set(a.note_id, []);
    actionsByNote.get(a.note_id)!.push(a);
  }

  for (const [employee, empNotes] of byEmployee.entries()) {
    // Collect all issues and actions across all notes for this employee
    const allIssues: string[] = [];
    const openActions: NoteAction[] = [];
    const doneActions: NoteAction[] = [];
    let latestDate: string | null = null;

    for (const note of empNotes) {
      if (note.meeting_date && !latestDate) latestDate = note.meeting_date;
      for (const issue of issuesByNote.get(note.note_id) ?? []) {
        if (!allIssues.includes(issue)) allIssues.push(issue);
      }
      for (const action of actionsByNote.get(note.note_id) ?? []) {
        const target = action.status === "open" ? openActions : doneActions;
        if (!target.find((a) => a.description === action.description)) {
          target.push(action);
        }
      }
    }

    const dateStr = latestDate ? ` · _${latestDate}_` : "";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*:bust_in_silhouette: ${employee}*${dateStr}`,
      },
    });

    if (allIssues.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Issues / Observations*\n${allIssues.map((i) => `> ${i}`).join("\n")}`,
        },
      });
    }

    if (openActions.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Open Action Items*\n${openActions
            .map((a) => `• :white_circle: ${a.description}${a.due_date ? ` _(due ${a.due_date})_` : ""}`)
            .join("\n")}`,
        },
      });
    }

    if (doneActions.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Completed*\n${doneActions.map((a) => `• :white_check_mark: ~${a.description}~`).join("\n")}`,
        },
      });
    }

    if (allIssues.length === 0 && openActions.length === 0) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "_No issues or actions recorded._" },
      });
    }

    blocks.push({ type: "divider" });
  }

  // Standalone tasks (not linked to an employee)
  if (tasks.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*:clipboard: Standalone Tasks*" },
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: tasks
          .map(
            (t) =>
              `${t.status === "open" ? ":white_circle:" : ":white_check_mark:"} ${t.status === "open" ? t.title : `~${t.title}~`}${t.due_date ? ` _(due ${t.due_date})_` : ""}`
          )
          .join("\n"),
      },
    });
    blocks.push({ type: "divider" });
  }

  return blocks;
}

export async function publishHome(client: WebClient, userId: string): Promise<void> {
  const { notes, issues, actions, tasks } = await fetchAllData();
  const blocks = buildHomeBlocks(notes, issues, actions, tasks);

  await client.views.publish({
    user_id: userId,
    view: {
      type: "home",
      blocks,
    },
  });
}
