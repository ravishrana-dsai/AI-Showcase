'use client';

import { useState } from 'react';
import { IndexedPrompt } from '@/lib/search';
import PromptCard from './PromptCard';
import PromptDetail from './PromptDetail';

interface PromptGridProps {
  prompts: IndexedPrompt[];
  totalCount: number;
}

export default function PromptGrid({ prompts, totalCount }: PromptGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);

  const visiblePrompts = prompts.slice(0, visibleCount);
  const expandedPrompt = prompts.find((p) => p.prompt_id === expandedId);

  if (prompts.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted text-sm">No prompts found. Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted mb-4">
        Showing {visiblePrompts.length} of {prompts.length} results (from {totalCount} total)
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visiblePrompts.map((prompt) => (
          <PromptCard
            key={prompt.prompt_id}
            prompt={prompt}
            isExpanded={expandedId === prompt.prompt_id}
            onToggle={() => setExpandedId(expandedId === prompt.prompt_id ? null : prompt.prompt_id)}
          />
        ))}
      </div>

      {visibleCount < prompts.length && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setVisibleCount((prev) => prev + 30)}
            className="px-6 py-2.5 rounded-xl glass text-sm font-medium glow-hover transition-all"
          >
            <span>Load more ({prompts.length - visibleCount} remaining)</span>
          </button>
        </div>
      )}

      {expandedPrompt && (
        <PromptDetail prompt={expandedPrompt} onClose={() => setExpandedId(null)} />
      )}
    </div>
  );
}
