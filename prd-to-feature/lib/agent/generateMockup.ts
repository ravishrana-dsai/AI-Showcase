import { generateImage, type ScreenshotInput } from "./client";

const MOCKUP_PROMPTS = [
  (prd: string, design: string, hasScreenshots: boolean) =>
    `Generate a high-fidelity UI mockup image for a web application feature. This should look like a professional design mockup or screenshot of a real web app.

The mockup should show the MAIN SCREEN of the feature described below, with realistic content, proper layout, modern styling (clean whites, subtle shadows, rounded corners), and a polished look.${hasScreenshots ? "\n\nIMPORTANT: The user has provided screenshots of their existing UI above. Match the visual style, color palette, typography, and layout patterns from those screenshots." : ""}

PRD Summary:
${prd.slice(0, 1500)}

Design Spec Summary:
${design.slice(0, 1500)}

Generate a clean, professional UI mockup image. Make it look like a real web application screenshot with realistic data and modern design.`,

  (prd: string, design: string, hasScreenshots: boolean) =>
    `Generate a high-fidelity UI mockup image showing an INTERACTION STATE of a web application feature. This could be a modal dialog open, a form being filled, a dropdown expanded, or an active/hover state.

Show a key user interaction moment for the feature described below. Use modern web design with clean styling, realistic mock data, and professional layout.${hasScreenshots ? "\n\nIMPORTANT: The user has provided screenshots of their existing UI above. Match the visual style, color palette, typography, and layout patterns from those screenshots." : ""}

PRD Summary:
${prd.slice(0, 1500)}

Design Spec Summary:
${design.slice(0, 1500)}

Generate a clean, professional UI mockup image showing a user interaction state. Make it look like a real web application screenshot.`,
];

/**
 * Generate 1-2 mockup images for the feature using Gemini's image generation.
 * Returns an array of base64 data URLs.
 */
export async function generateMockups(
  prd: string,
  designSpec: string,
  screenshots?: ScreenshotInput[]
): Promise<string[]> {
  const hasScreenshots = !!(screenshots && screenshots.length > 0);
  const mockups: string[] = [];

  for (let i = 0; i < MOCKUP_PROMPTS.length; i++) {
    try {
      console.log(`[generateMockup] Generating mockup ${i + 1}…`);
      // Prefix the prompt with screenshot context text when images are available.
      // The image model receives the combined text; we can't pass inlineData to
      // generateImage() directly, but the textual description is enough for style hints.
      const screenshotHint =
        hasScreenshots
          ? `[User has provided ${screenshots!.length} existing UI screenshot(s) as reference. Match their visual style.]\n\n`
          : "";
      const prompt = screenshotHint + MOCKUP_PROMPTS[i](prd, designSpec, hasScreenshots);
      const dataUrl = await generateImage(prompt);
      if (dataUrl) {
        mockups.push(dataUrl);
        console.log(`[generateMockup] Mockup ${i + 1} generated`);
      } else {
        console.warn(`[generateMockup] Mockup ${i + 1} returned no image`);
      }
    } catch (err) {
      console.error(
        `[generateMockup] Mockup ${i + 1} failed:`,
        err instanceof Error ? err.message : err
      );
    }

    // Brief delay between requests to avoid rate limits
    if (i < MOCKUP_PROMPTS.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return mockups;
}
