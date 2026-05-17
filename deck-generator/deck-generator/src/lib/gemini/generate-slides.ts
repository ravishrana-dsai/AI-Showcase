import { genai, CONTENT_MODEL } from './client';
import { getContentSystemPrompt, getContentUserPrompt } from './prompts';
import { SlideContentSchema } from './schemas';
import type { SlidePlanItem } from '@/types/generation';
import type { GeneratedSlide } from '@/types/deck';
import type { SlideTemplate, TemplateElement } from '@/lib/templates/types';
import type { PresentationPurpose } from '@/types/generation';

/**
 * Generates content for all slides in the plan.
 * Processes slides in batches of 3 for efficiency.
 *
 * @param slidePlan - The planned slides from content analysis
 * @param matchedTemplates - Map of slideIndex to matched SlideTemplate
 * @param bulletPoints - Original bullet points (split into array)
 * @param purpose - Presentation purpose
 * @returns Array of GeneratedSlide objects sorted by slideIndex
 */
export async function generateSlideContent(
  slidePlan: SlidePlanItem[],
  matchedTemplates: Map<number, SlideTemplate>,
  bulletPoints: string[],
  purpose: PresentationPurpose
): Promise<GeneratedSlide[]> {
  const systemPrompt = getContentSystemPrompt();

  // Process slides in batches of 3
  const batchSize = 3;
  const allSlides: GeneratedSlide[] = [];

  for (let i = 0; i < slidePlan.length; i += batchSize) {
    const batch = slidePlan.slice(i, i + batchSize);

    // Process batch in parallel
    const batchPromises = batch.map(async (slideItem) => {
      const template = matchedTemplates.get(slideItem.slideIndex);
      if (!template) {
        // Skip slides without matched templates instead of throwing
        console.warn(`[generate-slides] No template for slide ${slideItem.slideIndex}, skipping`);
        return null;
      }

      // Extract template elements that need content
      const elementsNeedingContent = extractContentElements(template.elements);

      // Get source bullet points for this slide
      const sourceBulletPoints = slideItem.sourcePointIndices.map(
        (idx) => bulletPoints[idx] || ''
      ).filter(Boolean);

      // Build slide context for the content user prompt
      const slideContext = {
        slideIndex: slideItem.slideIndex,
        category: slideItem.category,
        purpose: slideItem.purpose,
        presentationPurpose: purpose,
        sourceBulletPoints,
        templateElements: elementsNeedingContent.map((el) => ({
          id: el.id,
          role: el.role,
          maxChars: el.placeholder?.maxChars,
          label: el.placeholder?.label || el.id,
        })),
      };

      const userPrompt = getContentUserPrompt(slideContext);

      // Retry up to 2 times for transient errors
      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await genai.models.generateContent({
            model: CONTENT_MODEL,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.8,
              maxOutputTokens: 4096,
            },
          });

          const responseText = response.text;
          if (!responseText) {
            throw new Error(`No text content in Gemini response for slide ${slideItem.slideIndex}`);
          }

          // Parse JSON response
          let parsed: unknown;
          try {
            parsed = JSON.parse(responseText);
          } catch (parseErr) {
            throw new Error(
              `Failed to parse JSON for slide ${slideItem.slideIndex}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
            );
          }

          // Validate with Zod schema
          const validated = SlideContentSchema.parse(parsed);

          return {
            slideIndex: slideItem.slideIndex,
            templateId: template.id,
            content: validated.content,
            speakerNotes: validated.speakerNotes,
            chartData: validated.chartData,
          } as GeneratedSlide;
        } catch (error) {
          console.warn(`[generate-slides] Slide ${slideItem.slideIndex} attempt ${attempt + 1} failed:`, 
            error instanceof Error ? error.message : String(error));
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          } else {
            // Return a fallback slide with placeholder content
            console.warn(`[generate-slides] Returning placeholder for slide ${slideItem.slideIndex}`);
            const fallbackContent: Record<string, string> = {};
            for (const el of elementsNeedingContent) {
              fallbackContent[el.id] = el.placeholder?.label || el.id;
            }
            return {
              slideIndex: slideItem.slideIndex,
              templateId: template.id,
              content: fallbackContent,
              speakerNotes: '',
            } as GeneratedSlide;
          }
        }
      }
      return null; // Should not reach here
    });

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    allSlides.push(...batchResults.filter((s): s is GeneratedSlide => s !== null));
  }

  // Sort by slideIndex to ensure correct order
  return allSlides.sort((a, b) => a.slideIndex - b.slideIndex);
}

/**
 * Recursively extracts template elements that need content generation.
 * Elements need content if they have a placeholder or their role is not 'decorative'.
 */
function extractContentElements(elements: TemplateElement[]): TemplateElement[] {
  const result: TemplateElement[] = [];

  for (const element of elements) {
    // Skip decorative elements without placeholders
    if (element.role === 'decorative' && !element.placeholder) {
      continue;
    }

    // Include elements with placeholders or non-decorative roles
    if (element.placeholder || element.role !== 'decorative') {
      result.push(element);
    }

    // Recursively process children (for group elements)
    if (element.children) {
      result.push(...extractContentElements(element.children));
    }
  }

  return result;
}
