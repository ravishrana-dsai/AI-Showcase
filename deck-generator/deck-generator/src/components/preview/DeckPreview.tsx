'use client';

import React, { useState } from 'react';
import { useDeckStore } from '@/stores/deck-store';
import { getRegistry } from '@/lib/templates/registry';
import SlideRenderer from './SlideRenderer';
import SlideCarousel from './SlideCarousel';
import SpeakerNotesPanel from './SpeakerNotesPanel';
import { ExportDialog } from '@/components/export/ExportDialog';
import { Button } from '@/components/ui/Button';
import { ChevronUp, ChevronDown, Trash2, Download } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DeckPreview() {
  const deck = useDeckStore((s) => s.deck);
  const selectedSlideIndex = useDeckStore((s) => s.selectedSlideIndex);
  const setSelectedSlideIndex = useDeckStore((s) => s.setSelectedSlideIndex);
  const reorderSlides = useDeckStore((s) => s.reorderSlides);
  const deleteSlide = useDeckStore((s) => s.deleteSlide);

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  if (!deck || deck.slides.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No deck generated yet
        </h3>
        <p className="text-sm text-gray-600 max-w-md">
          Enter your key points and click Generate to create your presentation deck.
        </p>
      </div>
    );
  }

  const registry = getRegistry();
  const selectedSlide = deck.slides[selectedSlideIndex];
  const template = registry.getById(selectedSlide.templateId);

  if (!template) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-gray-500">Template not found for slide {selectedSlideIndex + 1}</p>
      </div>
    );
  }

  const canMoveUp = selectedSlideIndex > 0;
  const canMoveDown = selectedSlideIndex < deck.slides.length - 1;

  const handleMoveUp = () => {
    if (canMoveUp) {
      reorderSlides(selectedSlideIndex, selectedSlideIndex - 1);
    }
  };

  const handleMoveDown = () => {
    if (canMoveDown) {
      reorderSlides(selectedSlideIndex, selectedSlideIndex + 1);
    }
  };

  const handleDelete = () => {
    if (deck.slides.length > 1) {
      if (confirm(`Delete slide ${selectedSlideIndex + 1}?`)) {
        deleteSlide(selectedSlideIndex);
      }
    } else {
      alert('Cannot delete the last slide');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Slide Carousel */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <SlideCarousel />
      </div>

      {/* Main Slide Preview */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            key={selectedSlideIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SlideRenderer
              template={template}
              content={selectedSlide.content}
              colorTheme={deck.colorTheme}
              chartData={selectedSlide.chartData}
              className="shadow-xl"
            />
          </motion.div>
        </div>
      </div>

      {/* Slide Toolbar */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              Slide {selectedSlideIndex + 1} of {deck.slides.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Reorder buttons */}
            <div className="flex items-center gap-1 border-r border-gray-200 pr-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMoveUp}
                disabled={!canMoveUp}
                className="p-2"
                aria-label="Move slide up"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMoveDown}
                disabled={!canMoveDown}
                className="p-2"
                aria-label="Move slide down"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deck.slides.length === 1}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              aria-label="Delete slide"
            >
              <Trash2 className="w-4 h-4" />
            </Button>

            {/* Export button */}
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsExportDialogOpen(true)}
              className="ml-2"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Speaker Notes Panel */}
      <SpeakerNotesPanel />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
      />
    </div>
  );
}
