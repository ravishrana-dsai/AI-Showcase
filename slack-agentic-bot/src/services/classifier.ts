/**
 * Rule-based classifier: parses message text into structured entities.
 * V1: keyword + freehand pattern matching (Employee:, "1:1 with Name", "Name -", etc.)
 * Designed so an LLM can be plugged in later with the same output shape.
 */

export type FunctionType = "hrbp" | "generic";

export interface ClassifiedTask {
  type: "task";
  title: string;
  assigneeSlackId?: string;
  dueDate?: string;
}

export interface ClassifiedContent {
  type: "content";
  title?: string;
  contentType: string;
  body: string;
  tags?: string[];
}

export interface ClassifiedOneOnOne {
  type: "one_on_one";
  employeeSlackId?: string;
  employeeIdentifier?: string;
  meetingDate?: string;
  issues: string[];
  actionItems: { description: string; assignee?: string; due?: string }[];
}

export type ClassifiedEntity =
  | ClassifiedTask
  | ClassifiedContent
  | ClassifiedOneOnOne;

export interface ClassifierInput {
  text: string;
  channelId: string;
  userId: string;
  functionHint?: FunctionType;
}

/** Strip Slack mrkdwn formatting characters so regex name/pattern matching works on plain text. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*([^*]+)\*/g, "$1")   // *bold*
    .replace(/_([^_]+)_/g, "$1")     // _italic_
    .replace(/~([^~]+)~/g, "$1")     // ~strike~
    .replace(/`([^`]+)`/g, "$1")     // `code`
    .replace(/<[^>]+\|([^>]+)>/g, "$1") // <url|label>
    .replace(/<[^>]+>/g, "");        // <url>
}

// ---------- structured keyword patterns ----------
const STRUCTURED_EMPLOYEE_RE = /(?:employee|1:1|1-on-1|one[- ]?on[- ]?one)\s*[:\-]\s*([^\n]+)/i;
const STRUCTURED_ISSUE_RE    = /(?:issue|concern|topic)s?\s*[:\-]\s*([^\n]+(?:\n(?!\s*(?:action|task|employee|issue|due)[\s:\-])[^\n]*)*)/gim;
const STRUCTURED_ACTION_RE   = /(?:action|action item|todo)\s*[:\-]\s*([^\n]+)/gim;
const TASK_RE                = /(?:^|\n)\s*task\s*[:\-]\s*([^\n]+)/im;
const MEETING_DATE_RE        = /(?:date|meeting|1:1)\s*[:\-]\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i;

// ---------- freehand name extraction ----------
// All patterns below intentionally have NO /i flag so [A-Z] truly requires uppercase,
// preventing words like "after", "and" from being captured as part of a name.

// "1:1 with Name" / "sync with Name" — trigger is lowercase in freehand text
const FREEHAND_WITH_RE       = /(?:1:1|one.on.one|sync|meeting|chat|spoke|talked|catch[- ]?up) with ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;
// "had my 1:1 with Name"
const FREEHAND_HAD_RE        = /had (?:a |my )?(?:1:1|one.on.one|sync|meeting|chat) with ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;
// "Name sync today" at start of message
const FREEHAND_NAME_FIRST_RE = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?) (?:sync|1:1|one.on.one|catch[- ]?up)/m;
// "Name - <rest>" or "Name — <rest>" at start of a line
const FREEHAND_NAME_DASH_RE  = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?) [-–—]/m;
// "spoke to / talked to Name"
const FREEHAND_SPOKE_TO_RE   = /(?:spoke|talked|speaking|talking) to ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;
// "checking in on Name" / "Checking in on Name" (allow capital C at start)
const FREEHAND_CHECKING_RE   = /[Cc]hecking in on ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)|caught up with ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)|following up (?:with|on) ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;

// ---------- freehand action/issue extraction ----------
// Pattern 1: trigger-word phrases (full phrase captured, including trigger)
const FREEHAND_ACTION_RE = /((?:need to|needs to|follow up (?:with|on)|remind (?:me|myself) to|make sure to|loop in|worth (?:probing|discussing|flagging|exploring|addressing))[^.!?\n]{5,200})/gim;

// Pattern 2: imperative sentences — start of sentence with a clear action verb
// Catches things like "Schedule a chat", "Loop in her manager", "Send Priya the doc"
const IMPERATIVE_VERBS = [
  "Schedule","Set up","Arrange","Book","Plan",
  "Loop in","Follow up","Check in","Reach out","Connect",
  "Send","Share","Forward","Draft","Prepare",
  "Talk to","Speak to","Meet with","Have a chat",
  "Flag","Escalate","Raise","Discuss","Address",
  "Review","Revisit","Probe","Explore","Investigate",
  "Get","Ask","Confirm","Clarify","Ensure",
];
const IMPERATIVE_ACTION_RE = new RegExp(
  `(?:^|[.!?]\\s+)((?:${IMPERATIVE_VERBS.join("|")})\\s+[^.!?\\n]{8,200})`,
  "gm"
);

// Passive "needs to be X" patterns are observations not actions — filter them out
const PASSIVE_OBSERVATION_RE = /^needs? to be\b/i;
// Sentences containing feeling/issue words — captures the full observation sentence
const FREEHAND_ISSUE_RE  = /(?:he|she|they|employee)\s+(?:is|has been|feels?|mentioned|said|flagged|raised|brought up|expressed|seems?|appears?|looks?)\s+([^.!?\n]{10,150})/gim;
// Conflict / relationship / situation signals — capture the full sentence
const FREEHAND_SITUATION_RE = /(?:conflict|tension|issue|problem|concern|friction|struggle|challenge|disconnect)\s+(?:with|between|around|about)\s+([^.!?\n]{5,150})/gim;

// Extract a person's name mentioned directly in an action item sentence
// e.g. "send Pooja her..." → "Pooja", "check if Aditya has..." → "Aditya"
const ACTION_TARGET_NAME_RE = /(?:send|tell|inform|remind|check (?:in )?(?:with|if|on)|email|meet|ping|update)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i;
const ACTION_ABOUT_NAME_RE  = /\babout\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s\b/i;

function extractNameFromActionItem(sentence: string): string | undefined {
  const m = sentence.match(ACTION_TARGET_NAME_RE) ?? sentence.match(ACTION_ABOUT_NAME_RE);
  if (!m?.[1]) return undefined;
  const stopWords = new Set(["the", "a", "an", "his", "her", "their", "our", "your", "my", "if", "in", "on", "with"]);
  if (stopWords.has(m[1].toLowerCase())) return undefined;
  return m[1].trim();
}

function extractEmployeeName(text: string): string | undefined {
  // FREEHAND_CHECKING_RE has multiple alternation capture groups — find first non-null
  const checkingMatch = text.match(FREEHAND_CHECKING_RE);
  if (checkingMatch) {
    const name = checkingMatch[1] ?? checkingMatch[2] ?? checkingMatch[3];
    if (name) return name.trim();
  }

  const patterns = [
    FREEHAND_HAD_RE,
    FREEHAND_WITH_RE,
    FREEHAND_NAME_FIRST_RE,
    FREEHAND_SPOKE_TO_RE,
    STRUCTURED_EMPLOYEE_RE,
    FREEHAND_NAME_DASH_RE,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function extractStructuredOneOnOne(text: string): ClassifiedOneOnOne | null {
  const employeeIdentifier = extractEmployeeName(text);

  const issues: string[] = [];
  let m: RegExpExecArray | null;

  // structured keywords first
  const sIssueRe = new RegExp(STRUCTURED_ISSUE_RE.source, "gim");
  while ((m = sIssueRe.exec(text)) !== null) {
    issues.push(m[1].trim());
  }

  // freehand issue signals if no structured ones found
  if (issues.length === 0) {
    const fIssueRe = new RegExp(FREEHAND_ISSUE_RE.source, "gim");
    while ((m = fIssueRe.exec(text)) !== null) {
      const desc = m[1].trim();
      if (desc.length > 8) issues.push(desc);
    }
    const situRe = new RegExp(FREEHAND_SITUATION_RE.source, "gim");
    while ((m = situRe.exec(text)) !== null) {
      const desc = m[1].trim();
      if (desc.length > 5) issues.push(desc);
    }
  }

  const actionItems: { description: string; assignee?: string; due?: string }[] = [];

  // structured keywords first
  const sActionRe = new RegExp(STRUCTURED_ACTION_RE.source, "gim");
  while ((m = sActionRe.exec(text)) !== null) {
    actionItems.push({ description: m[1].trim() });
  }

  // freehand action signals if no structured ones found
  if (actionItems.length === 0) {
    // Pattern 1: trigger-word phrases
    const fActionRe = new RegExp(FREEHAND_ACTION_RE.source, "gim");
    while ((m = fActionRe.exec(text)) !== null) {
      const raw = m[1].trim().replace(/[.!?]+$/, "");
      if (PASSIVE_OBSERVATION_RE.test(raw)) continue; // skip "needs to be addressed"
      const parts = raw
        .split(/,\s*(?:and\s+)?(?=need to|needs to|follow up|loop in|remind|make sure|worth)/i)
        .map((p) => p.trim().replace(/^and\s+/i, "").replace(/[,;.]+$/, ""))
        .filter((p) => p.length > 8 && !PASSIVE_OBSERVATION_RE.test(p));
      for (const part of parts) {
        actionItems.push({ description: part });
      }
    }

    // Pattern 2: imperative sentences (Schedule a chat, Send Priya X, Loop in manager…)
    const impRe = new RegExp(IMPERATIVE_ACTION_RE.source, "gm");
    while ((m = impRe.exec(text)) !== null) {
      const desc = (m[1] ?? m[0]).trim().replace(/[.!?]+$/, "");
      if (desc.length > 8) actionItems.push({ description: desc });
    }
  }

  // deduplicate action items by description
  const seen = new Set<string>();
  const unique = actionItems.filter((a) => {
    const key = a.description.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  actionItems.length = 0;
  actionItems.push(...unique);

  const dateMatch = text.match(MEETING_DATE_RE);
  const meetingDate = dateMatch ? dateMatch[1] : undefined;

  if (employeeIdentifier || issues.length > 0 || actionItems.length > 0) {
    return {
      type: "one_on_one",
      employeeIdentifier,
      meetingDate,
      issues,
      actionItems,
    };
  }
  return null;
}

/**
 * When a message lists multi-person action items (e.g. "send Pooja X, check Aditya Y"),
 * group by the name extracted from each sentence and return one entity per person.
 * Falls back to a single entity if no per-item names are found.
 */
function splitOneOnOneByPerson(
  base: ClassifiedOneOnOne
): ClassifiedOneOnOne[] {
  if (base.actionItems.length === 0) return [base];

  const byPerson = new Map<string, { description: string; assignee?: string; due?: string }[]>();
  const unnamed: { description: string; assignee?: string; due?: string }[] = [];

  for (const ai of base.actionItems) {
    const name = extractNameFromActionItem(ai.description) ?? base.employeeIdentifier;
    if (name) {
      if (!byPerson.has(name)) byPerson.set(name, []);
      byPerson.get(name)!.push(ai);
    } else {
      unnamed.push(ai);
    }
  }

  if (byPerson.size <= 1) return [base];

  const results: ClassifiedOneOnOne[] = [];
  for (const [person, items] of byPerson.entries()) {
    results.push({
      type: "one_on_one",
      employeeIdentifier: person,
      meetingDate: base.meetingDate,
      issues: base.issues,
      actionItems: items,
    });
  }
  if (unnamed.length > 0) {
    results.push({
      type: "one_on_one",
      employeeIdentifier: base.employeeIdentifier,
      meetingDate: base.meetingDate,
      issues: [],
      actionItems: unnamed,
    });
  }
  return results;
}

function extractTask(text: string): ClassifiedTask | null {
  const match = text.match(TASK_RE);
  if (!match) return null;
  return { type: "task", title: match[1].trim() };
}

// Signals that indicate HRBP / people context in freehand text
const HRBP_FREEHAND_SIGNALS = [
  /(?:1:1|one.on.one|sync|catch[- ]?up)\s+with\s+[A-Z]/i,
  /had\s+(?:a\s+|my\s+)?(?:1:1|sync|meeting)\s+with/i,
  /(?:he|she|they)\s+(?:is|has been|feels?|mentioned|said|flagged|raised|brought up|expressed)/i,
  /(?:burnout|promotion|compensation|retention|leave|performance|feedback|career|development plan)/i,
  /(?:flight risk|watch closely|retention risk|checking in on|loop in|probing|restructure|vague about|expectations)/i,
  /(?:^|\n)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[-–—]/m,
  /(?:loop in|flag for|flagging for)\s+(?:his|her|their|the)?\s*(?:manager|skip|hr|team)/i,
];

const HRBP_STRUCTURED_SIGNALS = /(?:^|\n)\s*(?:employee|1:1|1-on-1|one[- ]?on[- ]?one)\s*[:\-]/im;

function inferFunction(channelId: string, text: string, channelName?: string): FunctionType {
  const name = (channelName || channelId).toLowerCase();
  if (name.includes("hrbp") || name.includes("1on1") || name.includes("one-on-one")) {
    return "hrbp";
  }
  if (HRBP_STRUCTURED_SIGNALS.test(text)) return "hrbp";
  for (const re of HRBP_FREEHAND_SIGNALS) {
    if (re.test(text)) return "hrbp";
  }
  return "generic";
}

export function classify(input: ClassifierInput): {
  functionType: FunctionType;
  entities: ClassifiedEntity[];
} {
  const { channelId, functionHint } = input;
  const text = stripMarkdown(input.text);
  const functionType = functionHint ?? inferFunction(channelId, text);
  const entities: ClassifiedEntity[] = [];

  if (functionType === "hrbp") {
    const oneOnOne = extractStructuredOneOnOne(text);
    if (oneOnOne) {
      const split = splitOneOnOneByPerson(oneOnOne);
      entities.push(...split);
    }
  }

  const task = extractTask(text);
  if (task) entities.push(task);

  if (entities.length === 0) {
    entities.push({
      type: "content",
      contentType: "note",
      body: text,
    });
  }

  return { functionType, entities };
}
