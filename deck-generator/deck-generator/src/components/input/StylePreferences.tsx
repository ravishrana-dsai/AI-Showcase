'use client';

import React from 'react';
import { useDeckStore } from '@/stores/deck-store';
import type { VisualStyle } from '@/lib/templates/types';
import { Minus, Building2, Palette, Zap } from 'lucide-react';

const styles: {
  value: VisualStyle;
  label: string;
  description: string;
  icon: React.ReactNode;
  colors: string[];
}[] = [
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Clean, lots of whitespace',
    icon: <Minus className="h-5 w-5" />,
    colors: ['#ffffff', '#f8fafc', '#1e293b', '#3b82f6'],
  },
  {
    value: 'corporate',
    label: 'Corporate',
    description: 'Professional, structured',
    icon: <Building2 className="h-5 w-5" />,
    colors: ['#1e3a5f', '#2563eb', '#f1f5f9', '#0f172a'],
  },
  {
    value: 'creative',
    label: 'Creative',
    description: 'Colorful, dynamic',
    icon: <Palette className="h-5 w-5" />,
    colors: ['#7c3aed', '#f59e0b', '#10b981', '#ec4899'],
  },
  {
    value: 'bold',
    label: 'Bold',
    description: 'High contrast, impactful',
    icon: <Zap className="h-5 w-5" />,
    colors: ['#000000', '#ef4444', '#ffffff', '#f59e0b'],
  },
];

export default function StylePreferences() {
  const style = useDeckStore((s) => s.style);
  const setStyle = useDeckStore((s) => s.setStyle);

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-700">
        Visual Style
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {styles.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStyle(s.value)}
            className={`group relative flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 transition-all ${
              style === s.value
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            {/* Color preview dots */}
            <div className="flex items-center gap-1.5">
              {s.colors.map((color, i) => (
                <div
                  key={i}
                  className="h-3.5 w-3.5 rounded-full border border-gray-200/80 ring-1 ring-inset ring-black/5"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="text-center">
              <span
                className={`text-[11px] font-semibold leading-tight ${
                  style === s.value ? 'text-blue-700' : 'text-gray-700'
                }`}
              >
                {s.label}
              </span>
              <p className="mt-0.5 text-[10px] leading-tight text-gray-500">
                {s.description}
              </p>
            </div>

            {/* Selected indicator */}
            {style === s.value && (
              <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm ring-2 ring-white">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
