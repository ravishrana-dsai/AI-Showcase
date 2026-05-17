// =============================================================================
// Generation Types — Deck Generator
// =============================================================================
// Types consumed and produced by the AI content-generation pipeline.
// =============================================================================

import type { VisualStyle, TemplateCategory } from '../lib/templates/types';
import type { Deck } from './deck';

// ---------------------------------------------------------------------------
// Purpose
// ---------------------------------------------------------------------------

/** High-level purpose that shapes tone, structure, and template selection. */
export type PresentationPurpose =
  | 'pitch'
  | 'report'
  | 'educational'
  | 'proposal'
  | 'general';

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

/** Payload sent by the client to kick off deck generation. */
export interface GenerateRequest {
  /** Raw bullet-point input from the user. */
  bulletPoints: string;
  /** Intended purpose of the presentation. */
  purpose: PresentationPurpose;
  /** Desired visual style. */
  style: VisualStyle;
  /** Optional colour scheme override (e.g. hex string or theme id). */
  colorScheme?: string;
  /** Desired number of slides (the pipeline may adjust). */
  slideCount?: number;
  /** Free-form instructions that augment the default generation logic. */
  additionalInstructions?: string;
}

/** The response returned after successful deck generation. */
export type GenerateResponse = Deck;

// ---------------------------------------------------------------------------
// Slide Planning
// ---------------------------------------------------------------------------

/** A single entry in the slide plan produced during content analysis. */
export interface SlidePlanItem {
  /** Zero-based index of the planned slide. */
  slideIndex: number;
  /** Template category best suited for this slide. Falls back to bullet-layout if unrecognized. */
  category: TemplateCategory | string;
  /** Optional sub-category for finer template matching. */
  subcategory?: string;
  /** Brief description of the slide's narrative purpose. */
  purpose: string;
  /** Indices into the original bullet-point list that feed this slide. */
  sourcePointIndices: number[];
  /** Relative content density hint. */
  contentDensity: 'low' | 'medium' | 'high';
  /** Whether the slide would benefit from a visual element. */
  needsVisual: boolean;
  /** Suggested visual type if `needsVisual` is true. */
  visualType?: string;
  /** Suggested chart sub-type (e.g. "bar", "pie") if applicable. */
  suggestedChartType?: string;
  /** Note describing how this slide transitions from the previous one. */
  transitionNote: string;
}

// ---------------------------------------------------------------------------
// Content Analysis
// ---------------------------------------------------------------------------

/** Output of the first-pass content analysis step. */
export interface ContentAnalysis {
  /** High-level narrative arc description (e.g. "problem-solution-impact"). */
  narrativeArc: string;
  /** Purpose confirmed or refined from user input. */
  confirmedPurpose: PresentationPurpose;
  /** Detected overall tone (e.g. "professional", "conversational"). */
  overallTone: string;
  /** AI-suggested presentation title. */
  suggestedTitle: string;
  /** Ordered plan of slides to be generated. */
  slidePlan: SlidePlanItem[];
  /** Optional colour suggestion based on content analysis. */
  colorSuggestion?: string;
}
