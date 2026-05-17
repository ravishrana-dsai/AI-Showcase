import { GoogleGenAI } from "@google/genai";

function getClient(): GoogleGenAI {
  const key =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY or GOOGLE_API_KEY is not set. Add it to .env.local."
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

const CHAT_MODEL = "gemini-2.0-flash";
const CHAT_RETRIES = 3;
const CHAT_BACKOFF_MS = [1000, 2000, 4000];

/** A screenshot passed from the browser as a base64 data URL (e.g. "data:image/png;base64,..."). */
export type ScreenshotInput = string;

/**
 * Parse a data URL into { mimeType, data } for the Gemini SDK inlineData format.
 */
function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: "image/png", data: dataUrl };
}

/**
 * Like `chat()` but also attaches screenshot images as inline parts so Gemini
 * sees them alongside the text. Falls back to plain chat() if no screenshots.
 */
export async function chatWithImages(
  messages: { role: "user" | "system"; content: string }[],
  screenshots: ScreenshotInput[],
  options?: { jsonMode?: boolean }
): Promise<string> {
  // If no screenshots, delegate to the standard text-only chat
  if (!screenshots || screenshots.length === 0) {
    return chat(messages, options);
  }

  const ai = getClient();
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const userParts = messages.filter((m) => m.role === "user").map((m) => m.content);
  const systemInstruction = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
  const textContent = userParts.join("\n\n") || "";

  // Build multimodal content: text first, then one inline image per screenshot
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: textContent },
    ...screenshots.map((s) => ({ inlineData: parseDataUrl(s) })),
  ];

  let lastError: unknown;
  for (let attempt = 0; attempt < CHAT_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = CHAT_BACKOFF_MS[attempt - 1] ?? 4000;
      console.warn(`[chatWithImages] Retrying (attempt ${attempt + 1}/${CHAT_RETRIES}) after ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const response = await ai.models.generateContent({
        model: CHAT_MODEL,
        contents: [{ role: "user", parts }],
        ...(systemInstruction && { systemInstruction }),
        config: {
          temperature: 0.3,
          ...(options?.jsonMode && { responseMimeType: "application/json" }),
        },
      });
      const text = response.text;
      if (text == null) throw new Error("Empty response from Gemini");
      return text;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[chatWithImages] Attempt ${attempt + 1} failed: ${msg}`);
      if (msg.includes("API_KEY") || msg.includes("PERMISSION_DENIED") || msg.includes("invalid")) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function chat(
  messages: { role: "user" | "system"; content: string }[],
  options?: { jsonMode?: boolean }
): Promise<string> {
  const ai = getClient();
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content);
  const userParts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  const systemInstruction =
    systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
  const userContent = userParts.join("\n\n") || "";

  let lastError: unknown;
  for (let attempt = 0; attempt < CHAT_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = CHAT_BACKOFF_MS[attempt - 1] ?? 4000;
      console.warn(`[chat] Retrying (attempt ${attempt + 1}/${CHAT_RETRIES}) after ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const response = await ai.models.generateContent({
        model: CHAT_MODEL,
        contents: userContent,
        ...(systemInstruction && { systemInstruction }),
        config: {
          temperature: 0.3,
          ...(options?.jsonMode && { responseMimeType: "application/json" }),
        },
      });

      const text = response.text;
      if (text == null) {
        throw new Error("Empty response from Gemini");
      }
      return text;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[chat] Attempt ${attempt + 1} failed: ${msg}`);
      // Don't retry on auth/key errors — they won't self-heal
      if (msg.includes("API_KEY") || msg.includes("PERMISSION_DENIED") || msg.includes("invalid")) {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// Image models tried in order. Override via IMAGE_MODELS env var (comma-separated).
// Falls back to the built-in list if the env var is not set.
const DEFAULT_IMAGE_MODELS = [
  "gemini-2.0-flash-exp-image-generation",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.0-flash",              // last-resort: text model that sometimes returns images
];
const IMAGE_MODELS: string[] = process.env.IMAGE_MODELS
  ? process.env.IMAGE_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
  : DEFAULT_IMAGE_MODELS;

/**
 * Extract the first inline image data from a Gemini response.
 * Handles both SDK-wrapped objects and plain JSON parts.
 */
function extractImageFromResponse(response: ReturnType<typeof Object.create>): string | null {
  const candidates = response.candidates as Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> };
    finishReason?: string;
  }> | undefined;

  if (!candidates || candidates.length === 0) {
    console.warn("[generateImage] No candidates in response");
    return null;
  }

  const candidate = candidates[0];
  const finishReason = candidate.finishReason;
  if (finishReason && finishReason !== "STOP") {
    console.warn(`[generateImage] Non-STOP finish reason: ${finishReason}`);
  }

  // Access content directly (not via optional chain) to avoid SDK proxy issues
  const content = candidate.content;
  if (!content) {
    console.warn("[generateImage] No content in candidate");
    return null;
  }

  const parts = content.parts;
  if (!parts || parts.length === 0) {
    console.warn("[generateImage] No parts in content");
    return null;
  }

  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data) {
      const mime = inline.mimeType || "image/png";
      return `data:${mime};base64,${inline.data}`;
    }
  }

  return null;
}

/**
 * Generate an image using Gemini's image generation model.
 * Tries multiple model names with retries. Returns a base64 data URL or null.
 */
export async function generateImage(prompt: string): Promise<string | null> {
  const ai = getClient();

  for (const model of IMAGE_MODELS) {
    // Try each model up to 2 times
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 3000));
        }
        console.log(`[generateImage] Trying model: ${model} (attempt ${attempt + 1})`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 0.4,
          },
        });

        const dataUrl = extractImageFromResponse(response);
        if (dataUrl) {
          console.log(`[generateImage] Success with model: ${model}`);
          return dataUrl;
        }
        console.warn(`[generateImage] Model ${model} returned no image data (attempt ${attempt + 1})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[generateImage] Model ${model} attempt ${attempt + 1} failed: ${msg}`);
        // On rate-limit, wait longer before next attempt
        if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate")) {
          console.warn("[generateImage] Rate limit detected — waiting 8s before next attempt");
          await new Promise((r) => setTimeout(r, 8000));
        }
        // Auth errors won't self-heal — skip remaining attempts for this model
        if (msg.includes("API_KEY") || msg.includes("PERMISSION_DENIED")) {
          console.error("[generateImage] Auth error — skipping remaining image models");
          return null;
        }
      }
    }
  }

  console.error("[generateImage] All models exhausted, returning null");
  return null;
}
