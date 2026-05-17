'use client';

import { useState, useMemo } from 'react';
import { Prompt } from '@/lib/types';
import { findBestPrompts, ScoredPrompt } from '@/lib/search';
import { CATEGORY_COLORS, COMPLEXITY_COLORS } from '@/lib/constants';
import PromptDetail from '../browse/PromptDetail';
import CopyButton from '../browse/CopyButton';

interface PromptGeneratorProps {
  prompts: Prompt[];
}

interface GeminiResult {
  generatedPrompt: string;
  explanation: string;
}

export default function PromptGenerator({ prompts }: PromptGeneratorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScoredPrompt[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<ScoredPrompt | null>(null);

  // Gemini state
  const [geminiResult, setGeminiResult] = useState<GeminiResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  const maxScore = useMemo(() => {
    if (results.length === 0) return 1;
    return results[0].relevanceScore;
  }, [results]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    // Library search
    const matches = findBestPrompts(prompts, query, 12);
    setResults(matches);
    setHasSearched(true);

    // Gemini generation (parallel)
    setIsGenerating(true);
    setGeminiResult(null);
    setGeminiError(null);

    const libraryContext = matches.slice(0, 3).map(
      (p) => `"${p.title}" — ${p.primary_use_case}`
    );

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: query, libraryContext }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGeminiError(data.error || 'Failed to generate prompt');
      } else {
        setGeminiResult({
          generatedPrompt: data.generatedPrompt,
          explanation: data.explanation,
        });
      }
    } catch {
      setGeminiError('Network error — could not reach the AI service');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const getRelevanceLabel = (score: number) => {
    const pct = (score / maxScore) * 100;
    if (pct >= 80) return { label: 'Excellent match', color: 'text-green-600 dark:text-green-400' };
    if (pct >= 50) return { label: 'Good match', color: 'text-blue-600 dark:text-blue-400' };
    return { label: 'Partial match', color: 'text-amber-600 dark:text-amber-400' };
  };

  return (
    <div className="space-y-8">
      {/* Input section */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-2 text-gradient">Prompt Generator</h2>
        <p className="text-muted text-sm mb-6">
          Describe what you want to accomplish. We&apos;ll generate an AI-crafted prompt <em>and</em> find the best matches from our library.
        </p>

        <div className="space-y-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. I want to write a blog post about AI trends for my tech company..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl glass text-foreground placeholder:text-muted/60 focus:outline-none input-glow text-sm resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Press Enter to search, Shift+Enter for new line</span>
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isGenerating}
              className="px-6 py-2.5 rounded-xl btn-gradient text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
              <span className="relative z-10">{isGenerating ? 'Generating...' : 'Find Best Prompts'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI-Generated Prompt Section */}
      {hasSearched && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            AI-Generated Prompt
            <span className="text-xs font-normal text-muted">(powered by Gemini)</span>
          </h3>

          {/* Loading skeleton */}
          {isGenerating && (
            <div className="rounded-xl glass p-6 glow-purple animate-pulse">
              <div className="h-4 bg-accent/10 rounded w-3/4 mb-3" />
              <div className="h-4 bg-accent/10 rounded w-full mb-3" />
              <div className="h-4 bg-accent/10 rounded w-5/6 mb-3" />
              <div className="h-4 bg-accent/10 rounded w-2/3 mb-3" />
              <div className="h-3 bg-accent/5 rounded w-1/2 mt-6" />
            </div>
          )}

          {/* Error state */}
          {geminiError && !isGenerating && (
            <div className="rounded-xl glass p-4" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <p className="text-sm text-red-500 dark:text-red-400">{geminiError}</p>
            </div>
          )}

          {/* Generated result */}
          {geminiResult && !isGenerating && (
            <div className="rounded-xl glass overflow-hidden glow-purple">
              <div className="p-6">
                <div className="relative">
                  <pre className="p-4 rounded-xl glass text-sm whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed">
                    {geminiResult.generatedPrompt}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={geminiResult.generatedPrompt} />
                  </div>
                </div>
                {geminiResult.explanation && (
                  <p className="mt-4 text-xs text-muted italic px-1">{geminiResult.explanation}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Library Results Section */}
      {hasSearched && results.length === 0 && !isGenerating && !geminiResult && (
        <div className="text-center py-12">
          <p className="text-muted text-sm">No matching prompts found. Try rephrasing your description.</p>
        </div>
      )}

      {hasSearched && results.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
            </svg>
            From Library
            <span className="text-xs font-normal text-muted">({results.length} matches)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((prompt, index) => {
              const catColor = CATEGORY_COLORS[prompt.category];
              const compColor = COMPLEXITY_COLORS[prompt.complexity];
              const relevance = getRelevanceLabel(prompt.relevanceScore);

              return (
                <div
                  key={prompt.prompt_id}
                  className="rounded-xl glass glow-hover p-4 cursor-pointer"
                  onClick={() => setSelectedPrompt(prompt)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-accent">#{index + 1}</span>
                    <span className={`text-[10px] font-medium ${relevance.color}`}>{relevance.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${catColor.bg} ${catColor.text} ${catColor.darkBg} ${catColor.darkText}`}>
                      {prompt.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${compColor.bg} ${compColor.text} ${compColor.darkBg} ${compColor.darkText}`}>
                      {prompt.complexity}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2">{prompt.title}</h3>
                  <p className="text-xs text-muted line-clamp-2">{prompt.primary_use_case}</p>
                  <div className="mt-3 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--glass-border)' }}>
                    <span className="text-xs text-muted">{prompt.output_type}</span>
                    <CopyButton text={prompt.prompt_text} label="Copy" className="text-[10px]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedPrompt && (
        <PromptDetail prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} />
      )}
    </div>
  );
}
