import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/** Strip markdown code fences from a Gemini response before JSON.parse(). */
export const stripJSON = (raw) => raw.replace(/```json|```/g, "").trim();

/** Convert #rrggbb hex to "r, g, b" string for rgba() usage. */
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ].join(", ");
}

const BRAND_DEFAULTS = {
  primary:   "#0D1B2A",
  secondary: "#FFFFFF",
  accent:    "#00C9A7",
  surface:   "#132336",
};

/**
 * Render all slides in the outline to a complete deck HTML string.
 *
 * @param {object} outline   - Validated deck JSON (matches slide.schema.json)
 * @param {string} apiKey    - Gemini API key
 * @param {object} [brand]   - Optional brand color overrides { primary, secondary, accent, surface }
 * @returns {Promise<string>} Complete HTML string ready to write to disk
 */
export async function renderDeck(outline, apiKey, brand = {}) {
  const b = { ...BRAND_DEFAULTS, ...brand };
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const [renderPrompt, baseHtml] = await Promise.all([
    readFile(join(ROOT, "prompts", "render.md"), "utf8"),
    readFile(join(ROOT, "templates", "base.html"), "utf8"),
  ]);

  const { deck } = outline;
  const slidesHtml = [];

  for (const slide of deck.slides) {
    const templatePath = join(
      ROOT,
      "templates",
      "slide-types",
      `${slide.type}.html`
    );

    let templateHtml;
    try {
      templateHtml = await readFile(templatePath, "utf8");
    } catch {
      throw new Error(`No template found for slide type: "${slide.type}"`);
    }

    const userMessage = [
      `## Slide JSON\n\`\`\`json\n${JSON.stringify(slide, null, 2)}\n\`\`\``,
      `## Deck context\n- title: ${deck.title}\n- client: ${deck.client}`,
      `## Template HTML\n\`\`\`html\n${templateHtml}\n\`\`\``,
      `## Base CSS classes (reference only — do not reproduce)\nSee base.html for available classes.`,
    ].join("\n\n");

    const result = await model.generateContent([
      { text: renderPrompt },
      { text: userMessage },
    ]);

    const raw = result.response.text();
    // Strip any accidental markdown fences
    const slideHtml = raw.replace(/```html|```/g, "").trim();
    slidesHtml.push(slideHtml);
  }

  // Inject slides, brand colors, and deck metadata into base.html
  const assembledSlides = slidesHtml.join("\n\n");
  const fullDeck = baseHtml
    .replaceAll("{{deck.title}}", deck.title)
    .replace("{{brand-primary}}",    b.primary)
    .replace("{{brand-secondary}}",  b.secondary)
    .replace("{{brand-accent}}",     b.accent)
    .replace("{{brand-surface}}",    b.surface)
    .replace("{{brand-accent-rgb}}", hexToRgb(b.accent))
    .replace("{{slides}}", assembledSlides);

  return fullDeck;
}
