'use client';

import React, { useEffect, useState } from 'react';
import { useDeckStore } from '@/stores/deck-store';
import { useGenerateDeck } from '@/hooks/useGenerateDeck';
import BulletPointInput from '@/components/input/BulletPointInput';
import PurposeSelector from '@/components/input/PurposeSelector';
import StylePreferences from '@/components/input/StylePreferences';
import DeckPreview from '@/components/preview/DeckPreview';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Wand2, Presentation, Brain, LayoutTemplate, Palette, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Progress step data for the generation stepper. */
const GENERATION_STEPS = [
  { id: 'analyze', label: 'Analyzing content', icon: Brain, keywords: ['Analyzing'] },
  { id: 'plan', label: 'Planning slides', icon: LayoutTemplate, keywords: ['Planning', 'Matching'] },
  { id: 'generate', label: 'Generating content', icon: FileText, keywords: ['Generating'] },
  { id: 'polish', label: 'Polishing & assembling', icon: Palette, keywords: ['Polishing', 'Almost', 'Assembling'] },
];

function getActiveStep(progress: string): number {
  if (!progress) return 0;
  for (let i = GENERATION_STEPS.length - 1; i >= 0; i--) {
    if (GENERATION_STEPS[i].keywords.some((kw) => progress.includes(kw))) {
      return i;
    }
  }
  return 0;
}

/** Animated progress bar that fills over an estimated duration. */
function GenerationProgress({ progress, isGenerating }: { progress: string; isGenerating: boolean }) {
  const activeStep = getActiveStep(progress);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isGenerating) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Estimate ~45s total generation time
  const estimatedTotal = 45;
  const progressPercent = Math.min(95, (elapsed / estimatedTotal) * 100);

  return (
    <div className="w-full max-w-md mx-auto space-y-8">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{progress}</span>
          <span>{elapsed}s</span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {GENERATION_STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = idx === activeStep;
          const isCompleted = idx < activeStep;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300',
                isActive && 'bg-blue-50 border border-blue-200 shadow-sm',
                isCompleted && 'bg-green-50 border border-green-200',
                !isActive && !isCompleted && 'bg-gray-50 border border-gray-100 opacity-50'
              )}
            >
              <div
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300',
                  isActive && 'bg-blue-100',
                  isCompleted && 'bg-green-100',
                  !isActive && !isCompleted && 'bg-gray-100'
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : isActive ? (
                  <Spinner size="sm" />
                ) : (
                  <Icon className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <span
                className={cn(
                  'text-sm font-medium transition-colors duration-300',
                  isActive && 'text-blue-700',
                  isCompleted && 'text-green-700',
                  !isActive && !isCompleted && 'text-gray-400'
                )}
              >
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function GeneratorPage() {
  const {
    slideCount,
    additionalInstructions,
    isGenerating,
    generationProgress,
    error,
    deck,
    setSlideCount,
    setAdditionalInstructions,
  } = useDeckStore();

  const { generate } = useGenerateDeck();

  const handleGenerate = () => {
    generate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:h-[calc(100vh-5.5rem)]">
          {/* Left Panel - Input Controls */}
          <div className="w-full lg:w-[380px] lg:flex-shrink-0">
            <Card className="flex flex-col lg:h-full lg:overflow-hidden" padding="none">
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:space-y-5 sm:p-5">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2 sm:text-2xl sm:mb-2">
                    <Sparkles className="w-5 h-5 text-blue-600 sm:w-6 sm:h-6" />
                    Deck Generator
                  </h1>
                  <p className="text-xs text-gray-600 sm:text-sm">
                    Create professional presentation decks from your key points
                  </p>
                </div>

                {/* Input Components */}
                <BulletPointInput />
                <PurposeSelector />
                <StylePreferences />

                {/* Optional: Slide Count */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">
                    Slide Count (Optional)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={slideCount || ''}
                    onChange={(e) =>
                      setSlideCount(
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    placeholder="Auto"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty for automatic slide count based on content
                  </p>
                </div>

                {/* Optional: Additional Instructions */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">
                    Additional Instructions (Optional)
                  </label>
                  <Textarea
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="E.g., 'Focus on data visualization', 'Use more charts', etc."
                    rows={2}
                    className="w-full resize-none"
                  />
                </div>

                {/* Generation Progress */}
                <AnimatePresence>
                  {isGenerating && generationProgress && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 rounded-lg bg-blue-50 border border-blue-200"
                    >
                      <div className="flex items-center gap-3 text-sm text-blue-700 font-medium">
                        <Spinner size="sm" />
                        <span>{generationProgress}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-3 rounded-lg bg-red-50 border border-red-200"
                    >
                      <p className="text-sm text-red-800">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Generate Button — pinned to the bottom so it's always accessible */}
              <div className="flex-shrink-0 border-t border-gray-100 bg-white p-4 sm:p-5">
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  isLoading={isGenerating}
                  size="lg"
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      Generate Deck
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex-1 min-w-0 flex flex-col">
            <Card className="flex-1 flex flex-col overflow-hidden" padding="none">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8"
                  >
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6">
                      <Wand2 className="w-10 h-10 text-blue-600 animate-pulse" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">
                      Creating Your Deck
                    </h2>
                    <p className="text-sm text-gray-500 mb-8">
                      This usually takes 15-45 seconds
                    </p>
                    <GenerationProgress
                      progress={generationProgress}
                      isGenerating={isGenerating}
                    />
                  </motion.div>
                ) : deck ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 overflow-hidden"
                  >
                    <DeckPreview />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8"
                  >
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6">
                      <Presentation className="w-12 h-12 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      Ready to Generate
                    </h2>
                    <p className="text-sm text-gray-600 max-w-md">
                      Enter your key points and click Generate to create your
                      presentation deck.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
