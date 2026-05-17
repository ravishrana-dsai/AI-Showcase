import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Schema matching ContentAnalysis type
// Category list is kept broad so Gemini's output validates even if it uses
// categories beyond the primary set recommended in the prompt.
export const ContentAnalysisSchema = z.object({
  narrativeArc: z.string(),
  confirmedPurpose: z.enum(['pitch', 'report', 'educational', 'proposal', 'general']),
  overallTone: z.string(),
  suggestedTitle: z.string(),
  slidePlan: z.array(
    z.object({
      slideIndex: z.number(),
      category: z.string(), // Accept any category string — matcher handles fallback
      subcategory: z.string().optional(),
      purpose: z.string(),
      sourcePointIndices: z.array(z.number()),
      contentDensity: z.enum(['low', 'medium', 'high']),
      needsVisual: z.boolean(),
      visualType: z.string().optional(),
      suggestedChartType: z.string().optional(),
      transitionNote: z.string(),
    })
  ),
  colorSuggestion: z.string().optional(),
});

// Schema for individual slide content output.
// Gemini sometimes returns null values in the content record, so we coerce them to empty strings.
export const SlideContentSchema = z.object({
  content: z.record(
    z.string(),
    z.string().nullable().transform((v) => v ?? '')
  ),
  speakerNotes: z.string().nullable().default('').transform((v) => v ?? ''),
  chartData: z.object({
    labels: z.array(z.string()),
    datasets: z.array(
      z.object({
        name: z.string(),
        values: z.array(z.number()),
      })
    ),
  }).optional().nullable().transform((v) => v ?? undefined),
});

/**
 * Converts a Zod schema to a JSON Schema compatible with Gemini's responseSchema.
 */
export function zodToGeminiSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchema(schema as any, { target: 'openApi3' }) as Record<string, unknown>;
}
