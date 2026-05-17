import { parsePrd } from "./parsePrd";
import { generateDesign } from "./generateDesign";
import { generateCode } from "./generateCode";
import { generatePreview } from "./generatePreview";
import { generateMockups } from "./generateMockup";
import type { ScreenshotInput } from "./client";

/** Race a promise against a timeout. Throws if the timeout fires first. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[pipeline] ${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

export type PipelineResult = {
  design: string;
  files: { path: string; content: string; isModified?: boolean }[];
  preview: string;
  mockups: string[];
};

export async function runPipeline(
  prd: string,
  sourceFiles?: { path: string; content: string }[],
  screenshots?: ScreenshotInput[]
): Promise<PipelineResult> {
  console.log("[pipeline] Starting…");
  const hasSourceFiles = sourceFiles && sourceFiles.length > 0;
  if (hasSourceFiles) {
    console.log(`[pipeline] Modify mode: ${sourceFiles.length} source file(s) provided`);
  }

  // Step 1: Parse PRD into a structured summary (best-effort)
  let designInput: string;
  try {
    console.log("[pipeline] Parsing PRD…");
    const parsed = await withTimeout(parsePrd(prd), 30_000, "parsePrd");
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    const criteria = Array.isArray(parsed.acceptanceCriteria)
      ? parsed.acceptanceCriteria
      : [];
    const summary = [
      `Title: ${parsed.title ?? "Feature"}`,
      `Problem: ${parsed.problem ?? ""}`,
      users.length > 0 ? `Users: ${users.join(", ")}` : "",
      criteria.length > 0 ? `Acceptance criteria: ${criteria.join("; ")}` : "",
      parsed.outOfScope ? `Out of scope: ${parsed.outOfScope}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    designInput = summary + "\n\n---\n\nOriginal PRD:\n" + prd;
    console.log("[pipeline] PRD parsed:", parsed.title ?? "(no title)");
  } catch (err) {
    console.error("[pipeline] Parse failed, using raw PRD:", err);
    designInput = prd;
  }

  // Step 2: Generate design spec
  let design: string;
  try {
    console.log("[pipeline] Generating design…");
    design = await withTimeout(generateDesign(designInput, screenshots), 60_000, "generateDesign");
    console.log("[pipeline] Design generated (" + design.length + " chars)");
  } catch (err) {
    console.error("[pipeline] Design failed:", err);
    design =
      "Design generation failed: " +
      (err instanceof Error ? err.message : "Unknown error");
  }

  // Step 2.5: Generate mockup images
  let mockups: string[] = [];
  try {
    console.log("[pipeline] Generating mockups…");
    mockups = await withTimeout(generateMockups(prd, design, screenshots), 90_000, "generateMockups");
    console.log("[pipeline] Mockups generated (" + mockups.length + " images)");
  } catch (err) {
    console.error("[pipeline] Mockups failed:", err);
  }

  // Step 3: Generate preview (do this BEFORE code to avoid rate limits)
  let preview: string;
  try {
    console.log("[pipeline] Generating preview…");
    preview = await withTimeout(generatePreview(prd, design, screenshots), 60_000, "generatePreview");
    console.log("[pipeline] Preview generated (" + preview.length + " chars)");
  } catch (err) {
    console.error("[pipeline] Preview failed:", err);
    preview = "";
  }

  // Step 4: Generate code files (or modify existing ones)
  let files: { path: string; content: string; isModified?: boolean }[];
  try {
    console.log("[pipeline] Generating code…");
    files = await withTimeout(generateCode(prd, design, hasSourceFiles ? sourceFiles : undefined, screenshots), 120_000, "generateCode");
    console.log("[pipeline] Code generated (" + files.length + " files)");
  } catch (err) {
    console.error("[pipeline] Code failed:", err);
    files = [];
  }

  console.log("[pipeline] Done.");
  return { design, files, preview, mockups };
}
