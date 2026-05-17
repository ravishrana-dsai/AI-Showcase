import { chat } from "./client";
import { PARSE_PRD_PROMPT } from "@/lib/prompts/parse";

export type ParsedPrd = {
  title: string;
  problem: string;
  users: string[];
  acceptanceCriteria: string[];
  outOfScope: string;
};

function fallback(prdText: string): ParsedPrd {
  return {
    title: "Feature",
    problem: prdText.slice(0, 200),
    users: [],
    acceptanceCriteria: [],
    outOfScope: "",
  };
}

function extractJson(raw: string): string | null {
  // Strip markdown code fences
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  // Try to find a JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export async function parsePrd(prdText: string): Promise<ParsedPrd> {
  try {
    const raw = await chat(
      [
        { role: "system", content: PARSE_PRD_PROMPT },
        { role: "user", content: prdText },
      ],
      { jsonMode: true }
    );
    const jsonStr = extractJson(raw);
    if (!jsonStr) return fallback(prdText);
    return JSON.parse(jsonStr) as ParsedPrd;
  } catch {
    return fallback(prdText);
  }
}
