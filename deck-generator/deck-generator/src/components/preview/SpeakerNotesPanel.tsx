'use client';

import React, { useState } from 'react';
import { useDeckStore } from '@/stores/deck-store';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function SpeakerNotesPanel() {
  const deck = useDeckStore((s) => s.deck);
  const selectedSlideIndex = useDeckStore((s) => s.selectedSlideIndex);
  const updateSpeakerNotes = useDeckStore((s) => s.updateSpeakerNotes);

  const [isOpen, setIsOpen] = useState(true);

  if (!deck || deck.slides.length === 0) {
    return null;
  }

  const selectedSlide = deck.slides[selectedSlideIndex];
  const currentNotes = selectedSlide?.speakerNotes || '';

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (selectedSlide) {
      updateSpeakerNotes(selectedSlideIndex, e.target.value);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          Speaker Notes
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <textarea
                value={currentNotes}
                onChange={handleNotesChange}
                placeholder="Add your speaker notes for this slide..."
                rows={4}
                className={cn(
                  'w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2',
                  'text-sm text-gray-800 placeholder-gray-400',
                  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                  'transition-all'
                )}
              />
              <p className="mt-2 text-xs text-gray-500">
                These notes are only visible to you and will be included in exports.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
