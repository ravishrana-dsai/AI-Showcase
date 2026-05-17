import type { PresentationPurpose } from '@/types/generation';
import type { VisualStyle } from '@/lib/templates/types';

/**
 * System prompt for content analysis phase.
 * Guides the AI to analyze bullet points and create a structured slide plan.
 */
export function getAnalysisSystemPrompt(): string {
  return `You are an expert presentation designer. Analyze bullet-point content and create a slide plan.

## Template Categories (use ONLY these):
title (sub: centered, left-aligned, bold, gradient) | agenda (numbered, grid) | section-divider (centered, bold) | bullet-layout (simple, with-icon, two-column, numbered) | icon-layout (3-col, 4-col, 6-col) | feature-highlight (3-col, highlight, grid) | process-flow (horizontal, vertical, 3-step, 4-step, 5-step) | timeline (horizontal, vertical, roadmap) | comparison (2-col, 3-col, pros-cons) | metrics-kpi (3-col, 4-col, dashboard) | statistic (single-stat, multi-stat) | closing (thank-you, CTA, contact, next-steps)

## Rules:
- ALWAYS start with 'title' (slideIndex: 0) and end with 'closing'
- Use section-divider between major topics ONLY if slide count allows
- Prefer visual templates over bullet-layout
- If a target slide count is specified, you MUST produce EXACTLY that many slides. Do NOT add extra slides.
- If no target is specified, keep 5-10 slides total
- Keep each SlidePlanItem concise: short purpose (under 15 words), short transitionNote (under 10 words)

## SlidePlanItem fields:
slideIndex (int), category (string), subcategory (string, optional), purpose (string, brief), sourcePointIndices (int[]), contentDensity (low|medium|high), needsVisual (bool), visualType (string, optional), suggestedChartType (string, optional), transitionNote (string, brief)

## Output:
Return JSON: { narrativeArc: string, confirmedPurpose: "pitch"|"report"|"educational"|"proposal"|"general", overallTone: string, suggestedTitle: string (3-8 words), slidePlan: SlidePlanItem[] }`;
}

/**
 * User prompt for content analysis.
 * Formats the user's inputs into a prompt for the analysis model.
 */
export function getAnalysisUserPrompt(
  bulletPoints: string,
  purpose: PresentationPurpose,
  style: VisualStyle,
  slideCount?: number
): string {
  const slideCountHint = slideCount
    ? `\n\nIMPORTANT: You MUST produce EXACTLY ${slideCount} slides in the slidePlan array. No more, no less.`
    : '';

  return `Analyze the following bullet-point content and create a comprehensive slide plan for a ${purpose} presentation with a ${style} visual style.

## Content to Analyze:
${bulletPoints}
${slideCountHint}

## Your Task:
1. Identify the narrative arc and overall structure
2. Determine the most appropriate presentation purpose (may differ from stated purpose)
3. Detect the tone and style
4. Create a logical sequence of slides that tells a compelling story
5. Match each slide to the best template category and subcategory
6. Ensure the first slide is 'title' and the last is 'closing'
7. Use 'section-divider' slides to separate major topics
8. Prefer visual templates when the content supports them

Return your analysis as a JSON object matching the ContentAnalysis schema.`;
}

/**
 * System prompt for content generation phase.
 * Guides the AI to generate polished slide content from templates and source material.
 */
export function getContentSystemPrompt(): string {
  return `You are an expert copywriter and presentation content specialist. Your role is to generate polished, professional slide content based on source bullet points and template specifications.

## Your Responsibilities:
1. Transform raw bullet points into polished, presentation-ready content
2. Respect all character limits and formatting constraints
3. Generate content that feels real, professional, and impactful
4. Never use placeholder brackets like [Company Name] or [Your Text Here]
5. Create speaker notes that help presenters deliver the slide effectively

## Content Rules:

### Titles:
- 3-8 words maximum
- No periods at the end
- Use title case
- Be concise and impactful
- Capture the essence of the slide

### Subtitles:
- One sentence maximum
- No periods unless it's a complete sentence
- Provide context or elaboration
- Keep under 100 characters when possible

### Body Text:
- Concise and scannable
- Use parallel structure for lists
- Avoid jargon unless appropriate for the audience
- Respect maxChars constraints strictly
- Break long content into multiple elements if needed

### Speaker Notes:
- 2-4 sentences explaining the slide's key points
- Provide context for the presenter
- Include talking points or transitions
- Help connect this slide to the overall narrative

### Chart Data (when applicable):
- Generate realistic, meaningful data
- Ensure labels and values are coherent
- Use appropriate number ranges
- Include 2-4 datasets when multiple series are needed

## Critical Constraints:
- **NEVER exceed maxChars** - truncate or summarize if needed
- **NEVER use placeholder text** - generate real, specific content
- **ALWAYS fill required fields** - check the required flag
- **RESPECT the element role** - titles should be titles, body should be body text
- **MAINTAIN consistency** - use consistent terminology throughout
- **ENSURE accuracy** - content should accurately reflect the source bullet points

## Output Format:
Return a JSON object with:
- content: Object mapping element IDs to their generated text content
- speakerNotes: String with presenter notes for this slide
- chartData: Optional object with labels and datasets (only if template includes chart elements)`;
}

/**
 * User prompt for generating content for a specific slide.
 * Includes slide context, source bullet points, and template element requirements.
 */
export function getContentUserPrompt(slideContext: {
  slideIndex: number;
  category: string;
  purpose: string;
  presentationPurpose?: string;
  sourceBulletPoints: string[];
  templateElements: {
    id: string;
    role: string;
    maxChars?: number;
    label: string;
  }[];
}): string {
  const { slideIndex, category, purpose, presentationPurpose, sourceBulletPoints, templateElements } = slideContext;

  const elementsDescription = templateElements
    .map((el) => {
      const charLimit = el.maxChars ? ` (max ${el.maxChars} chars)` : '';
      const required = el.maxChars ? '' : ' (required)';
      return `- ${el.id} (${el.role}): ${el.label}${charLimit}${required}`;
    })
    .join('\n');

  const purposeContext = presentationPurpose
    ? `\n## Presentation Context:\nThis is a ${presentationPurpose} presentation.`
    : '';

  return `Generate polished slide content for slide #${slideIndex + 1} (${category} category).${purposeContext}

## Slide Purpose:
${purpose}

## Source Content:
${sourceBulletPoints.map((bp, i) => `${i + 1}. ${bp}`).join('\n')}

## Template Elements to Fill:
${elementsDescription}

## Your Task:
1. Transform the source bullet points into polished content for each element
2. Respect all character limits strictly
3. Generate real, specific content (no placeholders)
4. Ensure content matches the element's role (title, subtitle, body, etc.)
5. Create comprehensive speaker notes
6. If this slide includes chart elements, generate appropriate chart data

Return your response as a JSON object matching the SlideContent schema.`;
}
