// =============================================================================
// Deck Types — Deck Generator
// =============================================================================
// Types that represent a fully-assembled presentation deck and its slides.
// =============================================================================

import type { ColorTheme } from '../lib/templates/types';

// ---------------------------------------------------------------------------
// Chart Data
// ---------------------------------------------------------------------------

/** Payload that feeds a chart element on a slide. */
export interface ChartDataPayload {
  /** Category / x-axis labels. */
  labels: string[];
  /** One or more data series. */
  datasets: {
    /** Series name (used in legends). */
    name: string;
    /** Numeric values corresponding to each label. */
    values: number[];
  }[];
}

// ---------------------------------------------------------------------------
// Generated Slide
// ---------------------------------------------------------------------------

/** A single slide as produced by the generation pipeline. */
export interface GeneratedSlide {
  /** Zero-based position of the slide within the deck. */
  slideIndex: number;
  /** ID of the template used to render this slide. */
  templateId: string;
  /**
   * Map of template element IDs to their generated text content.
   * Keys correspond to `TemplateElement.id` values.
   */
  content: Record<string, string>;
  /** Presenter notes for this slide. */
  speakerNotes: string;
  /** Optional chart data when the template contains a chart placeholder. */
  chartData?: ChartDataPayload;
}

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

/** A complete presentation deck ready for rendering / export. */
export interface Deck {
  /** Unique deck identifier. */
  id: string;
  /** Presentation title. */
  title: string;
  /** Ordered list of slides. */
  slides: GeneratedSlide[];
  /** Colour theme applied across all slides. */
  colorTheme: ColorTheme;
  /** Generation metadata. */
  metadata: {
    /** The stated purpose of the presentation. */
    purpose: string;
    /** High-level narrative arc description. */
    narrativeArc: string;
    /** Total number of slides in the deck. */
    slideCount: number;
    /** ISO-8601 timestamp of when the deck was generated. */
    generatedAt: string;
  };
}
