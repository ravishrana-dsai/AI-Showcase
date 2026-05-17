import { chatWithImages, type ScreenshotInput } from "./client";

const PREVIEW_INSTRUCTION = `Generate a self-contained HTML file that previews the UI described below.

CRITICAL RULES:
- Your ENTIRE response must be HTML starting with <!DOCTYPE html>
- Do NOT write any commentary, analysis, or explanation
- Do NOT review or critique the PRD
- ONLY output raw HTML code

Use this exact structure:

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <title>Preview</title>
</head>
<body class="bg-gray-50 min-h-screen p-8">
  <!-- Feature UI here with Tailwind classes -->
  <script>
    // Vanilla JS for interactivity
  </script>
</body>
</html>

Make it look polished: use a centered container (max-w-4xl mx-auto), proper spacing, realistic mock data, and working interactions (add/remove items, toggle states, etc).`;

/**
 * Generate a self-contained HTML preview of the feature's UI.
 */
export async function generatePreview(
  prd: string,
  designSpec: string,
  screenshots?: ScreenshotInput[]
): Promise<string> {
  const screenshotNote =
    screenshots && screenshots.length > 0
      ? `\n\nThe user has attached ${screenshots.length} screenshot(s) of their existing UI. Match the visual style, color scheme, and layout patterns shown in those screenshots.`
      : "";

  // Put the instruction IN the user message so Gemini can't ignore it
  const userContent = `${PREVIEW_INSTRUCTION}${screenshotNote}

---BEGIN PRD---
${prd}
---END PRD---

---BEGIN DESIGN SPEC---
${designSpec}
---END DESIGN SPEC---

Now generate the HTML preview. Start your response with <!DOCTYPE html>:`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      console.log(`[generatePreview] Attempt ${attempt + 1}…`);
      const raw = await chatWithImages(
        [
          {
            role: "system",
            content:
              "You are an HTML code generator. You ONLY output raw HTML. Never output explanations or commentary. Your response must always start with <!DOCTYPE html>.",
          },
          { role: "user", content: userContent },
        ],
        screenshots ?? []
      );

      console.log(
        `[generatePreview] Got response (${raw.length} chars), starts with: ${raw.slice(0, 80)}`
      );

      let html = raw.trim();
      // Strip markdown code fences if present
      html = html.replace(/^```(?:html)?\s*\n?/i, "");
      html = html.replace(/\n?\s*```\s*$/i, "");

      // Remove any text before <!DOCTYPE or <html
      const doctypeIdx = html.toLowerCase().indexOf("<!doctype");
      const htmlIdx = html.toLowerCase().indexOf("<html");
      const startIdx = doctypeIdx >= 0 ? doctypeIdx : htmlIdx;
      if (startIdx > 0) {
        html = html.slice(startIdx);
      }

      if (html.toLowerCase().startsWith("<!doctype") || html.toLowerCase().startsWith("<html")) {
        console.log(`[generatePreview] Success (${html.length} chars)`);
        return html;
      }

      // If it contains HTML tags but didn't start with doctype, wrap it
      if (html.includes("<div") || html.includes("<section") || html.includes("<main")) {
        html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen p-8">
${html}
</body>
</html>`;
        console.log(`[generatePreview] Wrapped in HTML shell (${html.length} chars)`);
        return html;
      }

      console.error(`[generatePreview] Response was not HTML, starts with: ${raw.slice(0, 100)}`);
    } catch (err) {
      console.error(
        `[generatePreview] Attempt ${attempt + 1} error:`,
        err instanceof Error ? err.message : err
      );
    }
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return "";
}
