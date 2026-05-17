import { genai, ANALYSIS_MODEL } from './client';
import { getAnalysisSystemPrompt, getAnalysisUserPrompt } from './prompts';
import { ContentAnalysisSchema } from './schemas';
import type { ContentAnalysis, PresentationPurpose } from '@/types/generation';
import type { VisualStyle } from '@/lib/templates/types';

const MAX_RETRIES = 2;

/**
 * Attempts to repair truncated JSON by closing open brackets/braces.
 */
function repairTruncatedJson(text: string): unknown | null {
  // Try as-is first
  try {
    return JSON.parse(text);
  } catch {
    // ignore
  }

  // Try to repair by closing open brackets/braces
  let repaired = text.trim();
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/]/g) || []).length;

  // Remove trailing comma if present
  repaired = repaired.replace(/,\s*$/, '');

  // Close unclosed brackets and braces
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }

  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

/**
 * Filters out null entries and re-indexes slidePlan items.
 */
function sanitizeSlidePlan(parsed: unknown): void {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'slidePlan' in parsed &&
    Array.isArray((parsed as Record<string, unknown>).slidePlan)
  ) {
    const plan = (parsed as Record<string, unknown>).slidePlan as unknown[];
    const filtered = plan.filter((item) => item != null);
    // Re-index slideIndex to be sequential
    filtered.forEach((item, idx) => {
      if (item && typeof item === 'object' && 'slideIndex' in item) {
        (item as Record<string, unknown>).slideIndex = idx;
      }
    });
    (parsed as Record<string, unknown>).slidePlan = filtered;
  }
}

/**
 * Analyzes raw bullet-point content and generates a structured slide plan.
 *
 * @param bulletPoints - Raw bullet-point input from the user
 * @param purpose - Intended presentation purpose
 * @param style - Desired visual style
 * @param slideCount - Optional target number of slides
 * @returns ContentAnalysis object with narrative arc, slide plan, and metadata
 */
export async function analyzeContent(
  bulletPoints: string,
  purpose: PresentationPurpose,
  style: VisualStyle,
  slideCount?: number
): Promise<ContentAnalysis> {
  const systemPrompt = getAnalysisSystemPrompt();
  const userPrompt = getAnalysisUserPrompt(bulletPoints, purpose, style, slideCount);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await genai.models.generateContent({
        model: ANALYSIS_MODEL,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          temperature: attempt === 0 ? 0.7 : 0.3,
          maxOutputTokens: 8192,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('No text content in Gemini response');
      }

      // Parse JSON response (with truncation repair)
      const parsed = repairTruncatedJson(responseText);
      if (parsed === null) {
        throw new Error(
          `Failed to parse Gemini response as JSON (length: ${responseText.length} chars). Response may be truncated.`
        );
      }

      // Defensive: filter out null entries in slidePlan
      sanitizeSlidePlan(parsed);

      const planLength = Array.isArray((parsed as Record<string, unknown>).slidePlan)
        ? ((parsed as Record<string, unknown>).slidePlan as unknown[]).length
        : 0;

      if (planLength === 0) {
        throw new Error('Gemini returned an empty slide plan. Retrying...');
      }

      // Validate with Zod schema
      const validated = ContentAnalysisSchema.parse(parsed);

      return validated;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[analyze] Attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(
    `Failed to analyze content after ${MAX_RETRIES + 1} attempts. Last error: ${lastError?.message}`
  );
}
