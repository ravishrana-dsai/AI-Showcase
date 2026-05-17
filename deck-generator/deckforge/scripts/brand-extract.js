import { GoogleGenerativeAI } from "@google/generative-ai";
import JSZip from "jszip";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const DEFAULTS = {
  primary:   "#0D1B2A",
  secondary: "#FFFFFF",
  accent:    "#00C9A7",
  surface:   "#132336",
};

function isHex(v) {
  return typeof v === "string" && HEX_RE.test(v);
}

function toHex(raw) {
  if (!raw) return null;
  const h = raw.replace(/^#/, "").trim();
  return h.length === 6 ? "#" + h.toUpperCase() : null;
}

/** Blend a hex color with white by `ratio` (0=original, 1=white). */
function lighten(hex, ratio) {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - ratio) + 255 * ratio);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - ratio) + 255 * ratio);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - ratio) + 255 * ratio);
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Pull a color value from a PPTX theme XML element tag.
 * Handles both <a:srgbClr val="RRGGBB"/> and <a:sysClr lastClr="RRGGBB"/>.
 */
function extractThemeColor(xml, tag) {
  const block = xml.match(new RegExp(`<a:${tag}>(.*?)<\/a:${tag}>`, "s"));
  if (!block) return null;
  const srgb = block[1].match(/srgbClr val="([0-9A-Fa-f]{6})"/);
  if (srgb) return toHex(srgb[1]);
  const sys = block[1].match(/lastClr="([0-9A-Fa-f]{6})"/);
  if (sys) return toHex(sys[1]);
  return null;
}

/** Parse brand colors out of a PPTX theme XML string. */
function parsePptxTheme(xml) {
  const dk2     = extractThemeColor(xml, "dk2");
  const lt1     = extractThemeColor(xml, "lt1");
  const accent1 = extractThemeColor(xml, "accent1");

  const primary   = isHex(dk2)     ? dk2     : DEFAULTS.primary;
  const secondary = isHex(lt1)     ? lt1     : DEFAULTS.secondary;
  const accent    = isHex(accent1) ? accent1 : DEFAULTS.accent;
  // Surface: primary lightened slightly for card backgrounds
  const surface   = lighten(primary, 0.12);

  return { primary, secondary, accent, surface };
}

/** Extract brand colors from a PPTX buffer by reading its embedded color theme. */
async function extractBrandFromPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  // Try theme1.xml first, then any theme file present
  const themeFile = zip.file("ppt/theme/theme1.xml");

  if (themeFile) {
    const themeXml = await themeFile.async("string");
    return parsePptxTheme(themeXml);
  }

  // Collect all fallback theme files synchronously, then await the first one
  const fallbacks = [];
  zip.forEach((path, file) => {
    if (path.startsWith("ppt/theme/") && path.endsWith(".xml")) {
      fallbacks.push(file);
    }
  });

  if (fallbacks.length === 0) {
    throw new Error("No color theme found in this PPTX file.");
  }

  const themeXml = await fallbacks[0].async("string");
  return parsePptxTheme(themeXml);
}

/** Extract brand colors from an image buffer using Gemini Vision. */
async function extractBrandFromImage(buffer, mimeType, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Analyze this image (it may be a slide, brand guide, logo, or screenshot) and extract the dominant brand colors.

Return ONLY a JSON object with exactly these four fields — no other text:
- primary: the main background or dominant dark/light color (hex)
- secondary: the primary text or contrasting color (hex)
- accent: the highlight, CTA, or brand signature color (hex)
- surface: a slightly lighter/darker variant of the primary for card backgrounds (hex)

Example: {"primary":"#0D1B2A","secondary":"#FFFFFF","accent":"#00C9A7","surface":"#132336"}`;

  const result = await model.generateContent([
    { inlineData: { data: buffer.toString("base64"), mimeType } },
    { text: prompt },
  ]);

  const clean = result.response.text().replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error("Gemini Vision returned invalid JSON for brand colors.");
  }

  return {
    primary:   isHex(parsed.primary)   ? parsed.primary   : DEFAULTS.primary,
    secondary: isHex(parsed.secondary) ? parsed.secondary : DEFAULTS.secondary,
    accent:    isHex(parsed.accent)    ? parsed.accent    : DEFAULTS.accent,
    surface:   isHex(parsed.surface)   ? parsed.surface   : DEFAULTS.surface,
  };
}

/**
 * Extract brand colors from an uploaded file.
 * Supports PPTX (reads embedded color theme) and images (uses Gemini Vision).
 *
 * @param {Buffer} buffer    - Raw file bytes
 * @param {string} mimeType  - File MIME type
 * @param {string} filename  - Original filename (used as fallback for type detection)
 * @param {string} apiKey    - Gemini API key
 */
export async function extractBrand(buffer, mimeType, filename, apiKey) {
  const isPptx =
    mimeType === PPTX_MIME ||
    (filename && filename.toLowerCase().endsWith(".pptx"));

  if (isPptx) {
    return extractBrandFromPptx(buffer);
  }

  return extractBrandFromImage(buffer, mimeType, apiKey);
}
