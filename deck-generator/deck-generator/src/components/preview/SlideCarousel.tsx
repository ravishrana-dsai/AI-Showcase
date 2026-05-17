'use client';

import React, { useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useDeckStore } from '@/stores/deck-store';
import { getRegistry } from '@/lib/templates/registry';
import SlideRenderer from './SlideRenderer';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SlideCarousel() {
  const deck = useDeckStore((s) => s.deck);
  const selectedSlideIndex = useDeckStore((s) => s.selectedSlideIndex);
  const setSelectedSlideIndex = useDeckStore((s) => s.setSelectedSlideIndex);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);

  useEffect(() => {
    if (!emblaApi) return;

    const updateScrollButtons = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };

    updateScrollButtons();
    emblaApi.on('select', updateScrollButtons);
    emblaApi.on('reInit', updateScrollButtons);

    return () => {
      emblaApi.off('select', updateScrollButtons);
      emblaApi.off('reInit', updateScrollButtons);
    };
  }, [emblaApi]);

  // Scroll to selected slide when it changes
  useEffect(() => {
    if (!emblaApi || !deck) return;
    emblaApi.scrollTo(selectedSlideIndex);
  }, [emblaApi, selectedSlideIndex, deck]);

  if (!deck || deck.slides.length === 0) {
    return null;
  }

  const registry = getRegistry();

  return (
    <div className="relative w-full">
      {/* Navigation arrows */}
      {canScrollPrev && (
        <button
          onClick={scrollPrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="Previous slides"
        >
          <ChevronLeft className="w-4 h-4 text-gray-700" />
        </button>
      )}
      {canScrollNext && (
        <button
          onClick={scrollNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          aria-label="Next slides"
        >
          <ChevronRight className="w-4 h-4 text-gray-700" />
        </button>
      )}

      {/* Carousel container */}
      <div className="overflow-hidden px-10" ref={emblaRef}>
        <div className="flex gap-3">
          {deck.slides.map((slide, index) => {
            const template = registry.getById(slide.templateId);
            if (!template) return null;

            const isSelected = index === selectedSlideIndex;

            return (
              <button
                key={`${slide.slideIndex}-${index}`}
                onClick={() => setSelectedSlideIndex(index)}
                className={cn(
                  'flex-shrink-0 relative group transition-all',
                  'w-32 h-20 rounded-lg overflow-hidden',
                  isSelected
                    ? 'ring-2 ring-blue-500 ring-offset-2 shadow-lg scale-105'
                    : 'ring-1 ring-gray-200 hover:ring-gray-300 hover:shadow-md'
                )}
                aria-label={`Slide ${index + 1}`}
              >
                {/* Slide number overlay */}
                <div
                  className={cn(
                    'absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded text-xs font-semibold',
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/90 text-gray-700'
                  )}
                >
                  {index + 1}
                </div>

                {/* Slide thumbnail */}
                <div className="w-full h-full">
                  <SlideRenderer
                    template={template}
                    content={slide.content}
                    colorTheme={deck.colorTheme}
                    chartData={slide.chartData}
                    scale={0.15}
                    className="pointer-events-none"
                  />
                </div>

                {/* Hover overlay */}
                {!isSelected && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
