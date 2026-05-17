import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import type { Deck } from '@/types/deck';
import type { RenderableDeck, RenderableSlide } from '@/types/export';
import { getRegistry } from '@/lib/templates/registry';

const ExportRequestSchema = z.object({
  deck: z.object({
    id: z.string(),
    title: z.string(),
    slides: z.array(z.any()),
    colorTheme: z.any(),
    metadata: z.any(),
  }),
});

/**
 * Convert a Deck to a RenderableDeck by resolving template IDs to full SlideTemplate objects.
 */
function deckToRenderable(deck: Deck): RenderableDeck {
  const registry = getRegistry();
  
  const renderableSlides: RenderableSlide[] = deck.slides.map((slide) => {
    const template = registry.getById(slide.templateId);
    
    if (!template) {
      throw new Error(`Template ${slide.templateId} not found in registry`);
    }

    return {
      template,
      content: slide.content,
      colorTheme: deck.colorTheme,
      chartData: slide.chartData,
      speakerNotes: slide.speakerNotes,
    };
  });

  return {
    title: deck.title,
    slides: renderableSlides,
    globalColorTheme: deck.colorTheme,
    slideSize: {
      width: 13.333, // 16:9 aspect ratio
      height: 7.5,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in with Google to export to Google Slides' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = ExportRequestSchema.parse(body);
    const deck: Deck = validated.deck as Deck;

    // Convert Deck to RenderableDeck
    const renderableDeck = deckToRenderable(deck);

    // Import renderToGoogleSlides dynamically (will be created separately)
    try {
      const { renderToGoogleSlides } = await import('@/lib/export/google-slides-renderer');
      const result = await renderToGoogleSlides(renderableDeck, session.accessToken);

      return NextResponse.json(result);
    } catch (importError) {
      // Renderer not yet implemented
      return NextResponse.json(
        { 
          error: 'Google Slides renderer not yet implemented',
          message: 'The renderToGoogleSlides function needs to be created in @/lib/export/google-slides-renderer'
        },
        { status: 501 }
      );
    }
  } catch (error) {
    console.error('Error exporting to Google Slides:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to export to Google Slides', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
