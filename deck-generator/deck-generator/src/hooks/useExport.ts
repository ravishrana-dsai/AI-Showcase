'use client';

import { useCallback } from 'react';
import { saveAs } from 'file-saver';
import { useDeckStore } from '@/stores/deck-store';
import { getRegistry } from '@/lib/templates/registry';
import type { Deck } from '@/types/deck';
import type { RenderableDeck, RenderableSlide } from '@/types/export';
import type { SlideTemplate } from '@/lib/templates/types';

/**
 * Convert a Deck to a RenderableDeck by resolving template IDs to full SlideTemplate objects.
 */
function convertToRenderableDeck(deck: Deck): RenderableDeck {
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

/**
 * Custom hook for exporting decks to various formats.
 * 
 * @returns Object containing export functions and loading state
 */
export function useExport() {
  const {
    deck,
    isExporting,
    exportFormat,
    setExporting,
    setError,
  } = useDeckStore();

  const exportPptx = useCallback(async () => {
    if (!deck) {
      setError('No deck available to export');
      return;
    }

    try {
      setExporting(true, 'pptx');

      // Dynamically import renderToPptx to avoid SSR issues
      const { renderToPptx } = await import('@/lib/export/pptx-renderer');

      // Convert Deck to RenderableDeck
      const renderableDeck = convertToRenderableDeck(deck);

      // Render to PPTX blob
      const blob = await renderToPptx(renderableDeck);

      // Download using file-saver
      saveAs(blob, `${deck.title}.pptx`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export PPTX';
      setError(errorMessage);
      console.error('Error exporting PPTX:', err);
    } finally {
      setExporting(false);
    }
  }, [deck, setExporting, setError]);

  const exportGoogleSlides = useCallback(async () => {
    if (!deck) {
      setError('No deck available to export');
      return;
    }

    try {
      setExporting(true, 'google-slides');

      // Call API endpoint
      const response = await fetch('/api/export/google-slides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deck }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Failed to export to Google Slides: ${response.statusText}`);
      }

      // Parse response
      const result = await response.json();
      
      // Open the presentation URL in a new tab
      if (result.presentationUrl) {
        window.open(result.presentationUrl, '_blank');
      } else if (result.url) {
        window.open(result.url, '_blank');
      } else {
        throw new Error('No presentation URL returned from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export to Google Slides';
      setError(errorMessage);
      console.error('Error exporting to Google Slides:', err);
    } finally {
      setExporting(false);
    }
  }, [deck, setExporting, setError]);

  return {
    exportPptx,
    exportGoogleSlides,
    isExporting,
    exportFormat,
  };
}
