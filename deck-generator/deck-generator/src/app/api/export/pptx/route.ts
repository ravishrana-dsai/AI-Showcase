import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Deck } from '@/types/deck';
import type { RenderableDeck, RenderableSlide } from '@/types/export';
import type { SlideTemplate } from '@/lib/templates/types';
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
    const body = await request.json();
    const validated = ExportRequestSchema.parse(body);
    const deck: Deck = validated.deck as Deck;

    // Convert Deck to RenderableDeck
    const renderableDeck = deckToRenderable(deck);

    // Import renderToPptx dynamically (will be created separately)
    // For now, return an error indicating the renderer needs to be implemented
    try {
      const { renderToPptx } = await import('@/lib/export/pptx-renderer');
      const blob = await renderToPptx(renderableDeck);

      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${deck.title.replace(/[^a-z0-9]/gi, '_')}.pptx"`,
        },
      });
    } catch (importError) {
      // Renderer not yet implemented
      return NextResponse.json(
        { 
          error: 'PPTX renderer not yet implemented',
          message: 'The renderToPptx function needs to be created in @/lib/export/pptx-renderer'
        },
        { status: 501 }
      );
    }
  } catch (error) {
    console.error('Error exporting PPTX:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to export PPTX', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
