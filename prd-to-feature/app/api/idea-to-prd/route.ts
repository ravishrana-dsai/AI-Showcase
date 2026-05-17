import { NextResponse } from "next/server";
import { chatWithImages } from "@/lib/agent/client";

export const maxDuration = 60;

const IDEA_TO_PRD_PROMPT = `You are an expert product manager. The user has described a feature idea in plain language. Your job is to write a complete, well-structured PRD (Product Requirements Document) from it.

Output a clean Markdown PRD with these sections:
# PRD: [Feature Title]

## Problem
What problem does this solve and for whom?

## Users
Who are the primary users of this feature?

## Goals
What are the key goals this feature should achieve?

## Acceptance Criteria
Numbered list of specific, testable acceptance criteria (at least 4-6).

## Out of Scope (v1)
What is explicitly NOT included in the first version?

Rules:
- Be specific and concrete — use realistic example data, UI labels, and user flows
- Each acceptance criterion must be testable and unambiguous  
- Write in a professional product management style
- Output ONLY the PRD markdown. No preamble or explanation.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idea = typeof body.idea === "string" ? body.idea.trim() : "";
    if (!idea) {
      return NextResponse.json(
        { error: "Idea text is required." },
        { status: 400 }
      );
    }

    // Accept optional screenshot data URLs for richer PRD generation
    const screenshots: string[] = Array.isArray(body.screenshots)
      ? body.screenshots.filter((s: unknown) => typeof s === "string" && s.startsWith("data:"))
      : [];

    const screenshotNote =
      screenshots.length > 0
        ? `\n\nThe user has also attached ${screenshots.length} screenshot(s) of their existing UI. Reference the visual context from those images when writing the PRD — describe UI elements, interactions, and flows that are consistent with what's shown.`
        : "";

    const prd = await chatWithImages(
      [
        { role: "system", content: IDEA_TO_PRD_PROMPT },
        { role: "user", content: `Feature idea: ${idea}${screenshotNote}` },
      ],
      screenshots
    );

    return NextResponse.json({ prd });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PRD generation failed";
    console.error("[/api/idea-to-prd] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
