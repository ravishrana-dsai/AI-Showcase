'use client';

import { create } from 'zustand';
import type { PresentationPurpose } from '@/types/generation';
import type { VisualStyle, ColorTheme } from '@/lib/templates/types';
import type { Deck } from '@/types/deck';

interface DeckState {
  // Input
  bulletPoints: string;
  purpose: PresentationPurpose;
  style: VisualStyle;
  slideCount: number | null;
  additionalInstructions: string;

  // Generation
  isGenerating: boolean;
  generationProgress: string;
  error: string | null;

  // Deck
  deck: Deck | null;
  selectedSlideIndex: number;

  // Export
  isExporting: boolean;
  exportFormat: 'pptx' | 'google-slides' | null;

  // Actions
  setBulletPoints: (text: string) => void;
  setPurpose: (purpose: PresentationPurpose) => void;
  setStyle: (style: VisualStyle) => void;
  setSlideCount: (count: number | null) => void;
  setAdditionalInstructions: (text: string) => void;
  setGenerating: (isGenerating: boolean) => void;
  setGenerationProgress: (progress: string) => void;
  setError: (error: string | null) => void;
  setDeck: (deck: Deck) => void;
  setSelectedSlideIndex: (index: number) => void;
  updateSlideContent: (slideIndex: number, elementId: string, content: string) => void;
  updateSpeakerNotes: (slideIndex: number, notes: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  deleteSlide: (index: number) => void;
  updateColorTheme: (theme: ColorTheme) => void;
  setExporting: (isExporting: boolean, format?: 'pptx' | 'google-slides' | null) => void;
  reset: () => void;
}

const initialState = {
  bulletPoints: '',
  purpose: 'general' as PresentationPurpose,
  style: 'minimal' as VisualStyle,
  slideCount: null,
  additionalInstructions: '',
  isGenerating: false,
  generationProgress: '',
  error: null,
  deck: null,
  selectedSlideIndex: 0,
  isExporting: false,
  exportFormat: null,
};

export const useDeckStore = create<DeckState>()((set) => ({
  ...initialState,

  setBulletPoints: (text) => set({ bulletPoints: text }),

  setPurpose: (purpose) => set({ purpose }),

  setStyle: (style) => set({ style }),

  setSlideCount: (count) => set({ slideCount: count }),

  setAdditionalInstructions: (text) => set({ additionalInstructions: text }),

  setGenerating: (isGenerating) =>
    set({
      isGenerating,
      ...(isGenerating ? { error: null } : {}),
    }),

  setGenerationProgress: (progress) => set({ generationProgress: progress }),

  setError: (error) => set({ error, isGenerating: false }),

  setDeck: (deck) =>
    set({
      deck,
      selectedSlideIndex: 0,
      isGenerating: false,
      generationProgress: '',
    }),

  setSelectedSlideIndex: (index) => set({ selectedSlideIndex: index }),

  updateSlideContent: (slideIndex, elementId, content) =>
    set((state) => {
      if (!state.deck) return state;
      const slides = [...state.deck.slides];
      const slide = { ...slides[slideIndex] };
      slide.content = { ...slide.content, [elementId]: content };
      slides[slideIndex] = slide;
      return { deck: { ...state.deck, slides } };
    }),

  updateSpeakerNotes: (slideIndex, notes) =>
    set((state) => {
      if (!state.deck) return state;
      const slides = [...state.deck.slides];
      slides[slideIndex] = { ...slides[slideIndex], speakerNotes: notes };
      return { deck: { ...state.deck, slides } };
    }),

  reorderSlides: (fromIndex, toIndex) =>
    set((state) => {
      if (!state.deck) return state;
      const slides = [...state.deck.slides];
      const [moved] = slides.splice(fromIndex, 1);
      slides.splice(toIndex, 0, moved);
      // Re-index
      const reindexed = slides.map((s, i) => ({ ...s, slideIndex: i }));
      return {
        deck: { ...state.deck, slides: reindexed },
        selectedSlideIndex:
          state.selectedSlideIndex === fromIndex
            ? toIndex
            : state.selectedSlideIndex,
      };
    }),

  deleteSlide: (index) =>
    set((state) => {
      if (!state.deck) return state;
      const slides = state.deck.slides.filter((_, i) => i !== index);
      const reindexed = slides.map((s, i) => ({ ...s, slideIndex: i }));
      const newSelected = Math.min(
        state.selectedSlideIndex,
        reindexed.length - 1
      );
      return {
        deck: {
          ...state.deck,
          slides: reindexed,
          metadata: {
            ...state.deck.metadata,
            slideCount: reindexed.length,
          },
        },
        selectedSlideIndex: Math.max(0, newSelected),
      };
    }),

  updateColorTheme: (theme) =>
    set((state) => {
      if (!state.deck) return state;
      return { deck: { ...state.deck, colorTheme: theme } };
    }),

  setExporting: (isExporting, format = null) =>
    set({ isExporting, exportFormat: format }),

  reset: () => set(initialState),
}));
