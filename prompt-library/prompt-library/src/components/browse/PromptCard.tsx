'use client';

import { Prompt } from '@/lib/types';
import { CATEGORY_COLORS, COMPLEXITY_COLORS } from '@/lib/constants';

interface PromptCardProps {
  prompt: Prompt;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function PromptCard({ prompt, isExpanded, onToggle }: PromptCardProps) {
  const catColor = CATEGORY_COLORS[prompt.category];
  const compColor = COMPLEXITY_COLORS[prompt.complexity];

  return (
    <div
      className={`rounded-xl p-4 transition-all cursor-pointer ${
        isExpanded
          ? 'glass border-gradient shadow-lg glow-purple'
          : 'glass glow-hover'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${catColor.bg} ${catColor.text} ${catColor.darkBg} ${catColor.darkText}`}>
            {prompt.category}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${compColor.bg} ${compColor.text} ${compColor.darkBg} ${compColor.darkText}`}>
            {prompt.complexity}
          </span>
        </div>
        <span className="text-[10px] text-muted shrink-0">{prompt.prompt_id}</span>
      </div>
      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{prompt.title}</h3>
      <p className="text-xs text-muted line-clamp-2">{prompt.primary_use_case}</p>
      <div className="mt-3 pt-2 flex items-center justify-between text-xs text-muted" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <span>{prompt.output_type}</span>
        <span>{prompt.supported_llms.length} LLMs</span>
      </div>
    </div>
  );
}
