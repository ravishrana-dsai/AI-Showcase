'use client';

import { useCallback, useRef } from 'react';
import { useDeckStore } from '@/stores/deck-store';
import type { GenerateRequest } from '@/types/generation';
import type { Deck } from '@/types/deck';

/**
 * Progress stages shown while generating. These simulate progress
 * based on typical timing since the API is a single POST request.
 */
const PROGRESS_STAGES = [
  { message: 'Analyzing your content...', delay: 0 },
  { message: 'Planning slide structure...', delay: 3000 },
  { message: 'Matching templates...', delay: 7000 },
  { message: 'Generating slide content...', delay: 12000 },
  { message: 'Polishing visuals...', delay: 20000 },
  { message: 'Almost there...', delay: 35000 },
];

/**
 * Custom hook for generating a deck from user input.
 * 
 * @returns Object containing generate function, loading state, and error state
 */
export function useGenerateDeck() {
  const {
    bulletPoints,
    purpose,
    style,
    slideCount,
    additionalInstructions,
    isGenerating,
    error,
    setGenerating,
    setGenerationProgress,
    setError,
    setDeck,
  } = useDeckStore();

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearProgressTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const startProgressTimers = useCallback(() => {
    clearProgressTimers();
    for (const stage of PROGRESS_STAGES) {
      const timer = setTimeout(() => {
        setGenerationProgress(stage.message);
      }, stage.delay);
      timersRef.current.push(timer);
    }
  }, [clearProgressTimers, setGenerationProgress]);

  const generate = useCallback(async () => {
    // Validate inputs
    if (!bulletPoints.trim()) {
      setError('Please provide bullet points to generate a deck');
      return;
    }

    try {
      // Set generating state
      setGenerating(true);
      setGenerationProgress(PROGRESS_STAGES[0].message);
      setError(null);

      // Start timed progress updates
      startProgressTimers();

      // Prepare request body
      const requestBody: GenerateRequest = {
        bulletPoints: bulletPoints.trim(),
        purpose,
        style,
        ...(slideCount !== null && { slideCount }),
        ...(additionalInstructions.trim() && { additionalInstructions: additionalInstructions.trim() }),
      };

      // Call API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Failed to generate deck: ${response.statusText}`);
      }

      // Final progress message
      clearProgressTimers();
      setGenerationProgress('Assembling your deck...');

      // Parse response
      const deck: Deck = await response.json();

      console.log('[DeckGenerator] Received deck:', deck?.id, 'slides:', deck?.slides?.length);

      if (!deck || !deck.slides || deck.slides.length === 0) {
        throw new Error('Server returned an empty deck. Please try again.');
      }

      // Set deck in store
      setDeck(deck);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while generating the deck';
      setError(errorMessage);
      console.error('Error generating deck:', err);
    } finally {
      clearProgressTimers();
      setGenerating(false);
      setGenerationProgress('');
    }
  }, [
    bulletPoints,
    purpose,
    style,
    slideCount,
    additionalInstructions,
    setGenerating,
    setGenerationProgress,
    setError,
    setDeck,
    startProgressTimers,
    clearProgressTimers,
  ]);

  return {
    generate,
    isGenerating,
    error,
  };
}
