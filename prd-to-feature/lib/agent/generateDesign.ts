import { chatWithImages, type ScreenshotInput } from "./client";
import { DESIGN_SPEC_PROMPT } from "@/lib/prompts/design";

export async function generateDesign(
  prdInput: string,
  screenshots?: ScreenshotInput[]
): Promise<string> {
  const screenshotNote =
    screenshots && screenshots.length > 0
      ? `\n\nThe user has attached ${screenshots.length} screenshot(s) of their existing UI. Use them as visual context — match the existing style, layout patterns, and component conventions where appropriate.`
      : "";

  const design = await chatWithImages(
    [
      { role: "system", content: DESIGN_SPEC_PROMPT },
      { role: "user", content: prdInput + screenshotNote },
    ],
    screenshots ?? []
  );
  return design.trim();
}
