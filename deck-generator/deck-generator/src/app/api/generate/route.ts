import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeContent } from '@/lib/gemini/analyze';
import { matchTemplates } from '@/lib/templates/matcher';
import { generateSlideContent } from '@/lib/gemini/generate-slides';
import { getRegistry } from '@/lib/templates/registry';
import { generateId } from '@/lib/utils';
import type { Deck } from '@/types/deck';
import type { GenerateRequest, PresentationPurpose } from '@/types/generation';
import type { VisualStyle, ColorTheme, SlideTemplate } from '@/lib/templates/types';

// Zod schema for GenerateRequest validation
const GenerateRequestSchema = z.object({
  bulletPoints: z.string().min(1, 'Bullet points are required'),
  purpose: z.enum(['pitch', 'report', 'educational', 'proposal', 'general']),
  style: z.enum(['minimal', 'corporate', 'creative', 'bold']),
  colorScheme: z.string().optional(),
  slideCount: z.number().int().positive().optional(),
  additionalInstructions: z.string().optional(),
});

/**
 * Create a default ColorTheme based on the visual style.
 */
function createDefaultColorTheme(style: VisualStyle): ColorTheme {
  const themes: Record<VisualStyle, ColorTheme> = {
    minimal: {
      id: 'minimal-default',
      name: 'Minimal Default',
      primary: '#2563EB',
      secondary: '#64748B',
      accent: '#3B82F6',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      textPrimary: '#1E293B',
      textSecondary: '#64748B',
      textOnPrimary: '#FFFFFF',
    },
    corporate: {
      id: 'corporate-default',
      name: 'Corporate Default',
      primary: '#1E3A5F',
      secondary: '#2563EB',
      accent: '#3B82F6',
      background: '#F1F5F9',
      surface: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      textOnPrimary: '#FFFFFF',
    },
    creative: {
      id: 'creative-default',
      name: 'Creative Default',
      primary: '#7C3AED',
      secondary: '#F59E0B',
      accent: '#10B981',
      background: '#FFFFFF',
      surface: '#FEF3C7',
      textPrimary: '#1E293B',
      textSecondary: '#64748B',
      textOnPrimary: '#FFFFFF',
    },
    bold: {
      id: 'bold-default',
      name: 'Bold Default',
      primary: '#000000',
      secondary: '#EF4444',
      accent: '#F59E0B',
      background: '#FFFFFF',
      surface: '#FEF2F2',
      textPrimary: '#000000',
      textSecondary: '#6B7280',
      textOnPrimary: '#FFFFFF',
    },
  };

  return themes[style];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validated = GenerateRequestSchema.parse(body);
    const generateRequest: GenerateRequest = validated;

    // Step 1: Analyze content
    const analysis = await analyzeContent(
      generateRequest.bulletPoints,
      generateRequest.purpose,
      generateRequest.style,
      generateRequest.slideCount
    );

    // Enforce slide count if specified — trim excess slides from the plan
    if (generateRequest.slideCount && analysis.slidePlan.length > generateRequest.slideCount) {
      analysis.slidePlan = analysis.slidePlan.slice(0, generateRequest.slideCount);
      // Re-index
      analysis.slidePlan.forEach((item, idx) => {
        item.slideIndex = idx;
      });
    }

    // Step 2: Match templates
    const templateMatches = matchTemplates(
      analysis.slidePlan,
      generateRequest.style,
      generateRequest.purpose
    );

    // Step 3: Get matched templates from registry
    const registry = getRegistry();
    const matchedTemplates = new Map<number, SlideTemplate>();
    
    for (const match of templateMatches) {
      const template = registry.getById(match.templateId);
      if (template) {
        matchedTemplates.set(match.slideIndex, template);
      } else {
        console.warn(`Template ${match.templateId} not found in registry`);
      }
    }

    // Step 4: Generate slide content
    // Convert bulletPoints string to array (split by newlines or bullets)
    const bulletPointsArray = generateRequest.bulletPoints
      .split(/\n|(?:\r\n)/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/^[-•*]\s*/, '')); // Remove bullet markers

    const generatedSlides = await generateSlideContent(
      analysis.slidePlan,
      matchedTemplates,
      bulletPointsArray,
      analysis.confirmedPurpose
    );

    // Step 5: Build ColorTheme (use colorScheme if provided, otherwise use default)
    let colorTheme: ColorTheme;
    if (generateRequest.colorScheme) {
      // Try to find theme by ID or use default
      // For now, use default based on style
      colorTheme = createDefaultColorTheme(generateRequest.style);
    } else {
      colorTheme = createDefaultColorTheme(generateRequest.style);
    }

    // Step 6: Assemble Deck object
    const deck: Deck = {
      id: generateId(),
      title: analysis.suggestedTitle,
      slides: generatedSlides,
      colorTheme,
      metadata: {
        purpose: analysis.confirmedPurpose,
        narrativeArc: analysis.narrativeArc,
        slideCount: generatedSlides.length,
        generatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(deck);
  } catch (error) {
    console.error('Error generating deck:', error);
    
    if (error instanceof z.ZodError) {
      // Check if this is a request validation error or a Gemini response parsing error
      const isRequestError = error.issues.some(
        (issue) => ['bulletPoints', 'purpose', 'style', 'colorScheme', 'slideCount', 'additionalInstructions'].includes(String(issue.path[0]))
      );
      if (isRequestError) {
        return NextResponse.json(
          { error: 'Invalid request', details: error.issues },
          { status: 400 }
        );
      }
      // Gemini returned malformed data — treat as a server error
      return NextResponse.json(
        { error: 'Failed to generate deck', message: 'The AI returned an unexpected response. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate deck', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
