// =============================================================================
// Export Types — Deck Generator
// =============================================================================
// Types used by the rendering / export pipeline to produce final output files.
// =============================================================================

import type { SlideTemplate, ColorTheme } from '../lib/templates/types';
import type { ChartDataPayload } from './deck';

// ---------------------------------------------------------------------------
// Renderable Slide
// ---------------------------------------------------------------------------

/** A slide fully resolved and ready to be rendered into an output format. */
export interface RenderableSlide {
  /** The template that defines the slide's layout and elements. */
  template: SlideTemplate;
  /**
   * Map of template element IDs to their final text content.
   * Keys correspond to `TemplateElement.id` values.
   */
  content: Record<string, string>;
  /** Colour theme applied to this slide. */
  colorTheme: ColorTheme;
  /** Optional chart data for chart-placeholder elements. */
  chartData?: ChartDataPayload;
  /** Presenter notes attached to this slide. */
  speakerNotes: string;
}

// ---------------------------------------------------------------------------
// Renderable Deck
// ---------------------------------------------------------------------------

/** A complete deck resolved and ready for export. */
export interface RenderableDeck {
  /** Presentation title. */
  title: string;
  /** Ordered list of renderable slides. */
  slides: RenderableSlide[];
  /** Colour theme applied globally (individual slides may override). */
  globalColorTheme: ColorTheme;
  /** Canonical slide dimensions in inches. */
  slideSize: {
    /** Slide width in inches (default 13.333 for 16:9). */
    width: number;
    /** Slide height in inches (default 7.5 for 16:9). */
    height: number;
  };
}

// ---------------------------------------------------------------------------
// Export Format
// ---------------------------------------------------------------------------

/** Supported output formats for deck export. */
export type ExportFormat = 'pptx' | 'google-slides';
