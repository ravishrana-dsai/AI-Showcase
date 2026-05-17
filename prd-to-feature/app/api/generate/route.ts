import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/agent";

export const maxDuration = 300; // allow up to 5 min for LLM calls (pipeline typically takes 2-3 min)

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prd = typeof body.prd === "string" ? body.prd.trim() : "";
    if (!prd) {
      return NextResponse.json(
        { error: "PRD text is required and must be non-empty." },
        { status: 400 }
      );
    }

    const sourceFiles: { path: string; content: string }[] = Array.isArray(body.sourceFiles)
      ? body.sourceFiles.filter(
          (f: unknown) =>
            f &&
            typeof f === "object" &&
            typeof (f as { path: string }).path === "string" &&
            typeof (f as { content: string }).content === "string"
        )
      : [];

    const screenshots: string[] = Array.isArray(body.screenshots)
      ? body.screenshots.filter((s: unknown) => typeof s === "string" && s.startsWith("data:"))
      : [];

    const result = await runPipeline(prd, sourceFiles, screenshots);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[/api/generate] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
