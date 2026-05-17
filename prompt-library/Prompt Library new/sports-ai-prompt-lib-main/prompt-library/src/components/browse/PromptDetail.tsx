'use client';

import { useState } from 'react';
import { Prompt } from '@/lib/types';
import { CATEGORY_COLORS, COMPLEXITY_COLORS } from '@/lib/constants';
import CopyButton from './CopyButton';

interface PromptDetailProps {
  prompt: Prompt;
  onClose: () => void;
}

type VariationTab = 'main' | 'short' | 'detailed' | 'strict';

export default function PromptDetail({ prompt, onClose }: PromptDetailProps) {
  const [activeVariation, setActiveVariation] = useState<VariationTab>('main');
  const catColor = CATEGORY_COLORS[prompt.category];
  const compColor = COMPLEXITY_COLORS[prompt.complexity];

  const variationTabs: { key: VariationTab; label: string }[] = [
    { key: 'main', label: 'Main' },
    { key: 'short', label: 'Short' },
    { key: 'detailed', label: 'Detailed' },
    { key: 'strict', label: 'Strict' },
  ];

  const getPromptText = () => {
    if (activeVariation === 'main') return prompt.prompt_text;
    return prompt.variations[activeVariation];
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-12 px-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-3xl glass-strong rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient accent bar at top */}
        <div className="h-1 w-full bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)]" />

        {/* Header */}
        <div className="p-6" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${catColor.bg} ${catColor.text} ${catColor.darkBg} ${catColor.darkText}`}>
                  {prompt.category}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${compColor.bg} ${compColor.text} ${compColor.darkBg} ${compColor.darkText}`}>
                  {prompt.complexity}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium glass text-muted">
                  {prompt.output_type}
                </span>
                <span className="text-[10px] text-muted ml-auto">{prompt.prompt_id}</span>
              </div>
              <h2 className="text-xl font-bold">{prompt.title}</h2>
              <p className="text-sm text-muted mt-1">{prompt.primary_use_case}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg glass glow-hover text-muted hover:text-foreground shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Prompt text with variation tabs */}
        <div className="p-6">
          <div className="flex items-center gap-1 mb-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
            {variationTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveVariation(tab.key)}
                className={`px-4 py-2 text-sm font-medium relative transition-colors ${
                  activeVariation === tab.key
                    ? 'text-gradient tab-active-gradient font-semibold'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <pre className="p-4 rounded-xl glass text-sm whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed">
              {getPromptText()}
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={getPromptText()} />
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-medium text-muted mb-1">User Role</h4>
            <p className="text-sm">{prompt.user_role}</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted mb-1">Industry</h4>
            <p className="text-sm">{prompt.industry}</p>
          </div>
          {prompt.secondary_use_cases.length > 0 && (
            <div className="sm:col-span-2">
              <h4 className="text-xs font-medium text-muted mb-2">Secondary Use Cases</h4>
              <div className="flex flex-wrap gap-1.5">
                {prompt.secondary_use_cases.map((uc, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-[11px] glass text-muted">
                    {uc}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="sm:col-span-2">
            <h4 className="text-xs font-medium text-muted mb-2">Supported LLMs</h4>
            <div className="flex flex-wrap gap-1.5">
              {prompt.supported_llms.map((llm) => (
                <span key={llm} className="px-2 py-0.5 rounded-full text-[11px] glass text-muted">
                  {llm}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tips */}
        {prompt.tips && (
          <div className="px-6 pb-6">
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10" style={{ border: '1px solid rgba(217, 119, 6, 0.2)' }}>
              <h4 className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Tips</h4>
              <p className="text-sm text-amber-900 dark:text-amber-200/80">{prompt.tips}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
