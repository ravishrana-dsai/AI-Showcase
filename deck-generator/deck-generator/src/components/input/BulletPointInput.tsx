'use client';

import React, { useCallback, useMemo } from 'react';
import { useDeckStore } from '@/stores/deck-store';
import { List, Lightbulb } from 'lucide-react';

const EXAMPLES = [
  "Our company grew 300% in revenue last year",
  "We serve 10,000+ customers in 50 countries",
  "Our 3-step process: discover, build, launch",
  "Team of 25 engineers, designers, and marketers",
  "Next quarter goals: expand to Europe, launch mobile app",
];

export default function BulletPointInput() {
  const bulletPoints = useDeckStore((s) => s.bulletPoints);
  const setBulletPoints = useDeckStore((s) => s.setBulletPoints);

  const lineCount = useMemo(() => {
    if (!bulletPoints.trim()) return 0;
    return bulletPoints.split('\n').filter((line) => line.trim()).length;
  }, [bulletPoints]);

  const loadExample = useCallback(() => {
    setBulletPoints(EXAMPLES.join('\n'));
  }, [setBulletPoints]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <List className="h-4 w-4 text-blue-600" />
          Your Key Points
        </label>
        <button
          type="button"
          onClick={loadExample}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
        >
          <Lightbulb className="h-3 w-3" />
          Load Example
        </button>
      </div>

      <div className="relative">
        <textarea
          value={bulletPoints}
          onChange={(e) => setBulletPoints(e.target.value)}
          placeholder={`Enter your bullet points, one per line...\n\nExample:\n${EXAMPLES.slice(0, 3).join('\n')}`}
          rows={6}
          className="w-full min-h-[120px] resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {lineCount > 0
            ? `${lineCount} point${lineCount !== 1 ? 's' : ''} entered`
            : 'No points yet'}
        </span>
        <span>Tip: Each line becomes a potential slide point</span>
      </div>
    </div>
  );
}
