'use client';

import React, { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useDeckStore } from '@/stores/deck-store';
import type { ColorTheme } from '@/lib/templates/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

// Predefined color themes
const PRESET_THEMES: ColorTheme[] = [
  {
    id: 'blue-modern',
    name: 'Blue Modern',
    primary: '#2563eb',
    secondary: '#3b82f6',
    accent: '#60a5fa',
    background: '#ffffff',
    surface: '#f8fafc',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    textOnPrimary: '#ffffff',
  },
  {
    id: 'dark-elegant',
    name: 'Dark Elegant',
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#a78bfa',
    background: '#0f172a',
    surface: '#1e293b',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textOnPrimary: '#ffffff',
  },
  {
    id: 'warm-sunset',
    name: 'Warm Sunset',
    primary: '#f59e0b',
    secondary: '#f97316',
    accent: '#fb923c',
    background: '#fff7ed',
    surface: '#ffedd5',
    textPrimary: '#431407',
    textSecondary: '#78350f',
    textOnPrimary: '#ffffff',
  },
  {
    id: 'green-nature',
    name: 'Green Nature',
    primary: '#10b981',
    secondary: '#059669',
    accent: '#34d399',
    background: '#ffffff',
    surface: '#f0fdf4',
    textPrimary: '#064e3b',
    textSecondary: '#047857',
    textOnPrimary: '#ffffff',
  },
  {
    id: 'purple-creative',
    name: 'Purple Creative',
    primary: '#8b5cf6',
    secondary: '#7c3aed',
    accent: '#a78bfa',
    background: '#faf5ff',
    surface: '#f3e8ff',
    textPrimary: '#581c87',
    textSecondary: '#6b21a8',
    textOnPrimary: '#ffffff',
  },
  {
    id: 'minimal-gray',
    name: 'Minimal Gray',
    primary: '#374151',
    secondary: '#4b5563',
    accent: '#6b7280',
    background: '#ffffff',
    surface: '#f9fafb',
    textPrimary: '#111827',
    textSecondary: '#6b7280',
    textOnPrimary: '#ffffff',
  },
];

export default function ColorPicker() {
  const deck = useDeckStore((state) => state.deck);
  const updateColorTheme = useDeckStore((state) => state.updateColorTheme);
  const [isCustomizing, setIsCustomizing] = useState(false);

  const currentTheme = deck?.colorTheme || PRESET_THEMES[0];

  if (!deck) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          No deck loaded. Generate a deck first to customize colors.
        </p>
      </div>
    );
  }

  const handlePresetSelect = (theme: ColorTheme) => {
    updateColorTheme(theme);
    setIsCustomizing(false);
  };

  const handleCustomColorChange = (key: keyof ColorTheme, value: string) => {
    if (!deck) return;
    updateColorTheme({
      ...currentTheme,
      [key]: value,
    });
  };

  const colorFields: Array<{ key: keyof ColorTheme; label: string }> = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
    { key: 'background', label: 'Background' },
    { key: 'surface', label: 'Surface' },
    { key: 'textPrimary', label: 'Text Primary' },
    { key: 'textSecondary', label: 'Text Secondary' },
    { key: 'textOnPrimary', label: 'Text on Primary' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Color Theme</h3>
      </div>

      {/* Preset Themes */}
      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">Preset Themes</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PRESET_THEMES.map((theme) => {
            const isSelected = currentTheme.id === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handlePresetSelect(theme)}
                className={cn(
                  'group relative overflow-hidden rounded-lg border-2 p-3 text-left transition-all',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {theme.name}
                  </span>
                  {isSelected && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="flex gap-1">
                  <div
                    className="h-6 flex-1 rounded"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <div
                    className="h-6 flex-1 rounded"
                    style={{ backgroundColor: theme.secondary }}
                  />
                  <div
                    className="h-6 flex-1 rounded"
                    style={{ backgroundColor: theme.accent }}
                  />
                  <div
                    className="h-6 flex-1 rounded border border-gray-300"
                    style={{ backgroundColor: theme.background }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Color Editor */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Custom Colors</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCustomizing(!isCustomizing)}
          >
            {isCustomizing ? 'Hide' : 'Customize'}
          </Button>
        </div>

        {isCustomizing && (
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {colorFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-700">
                    {field.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={currentTheme[field.key] as string}
                      onChange={(e) =>
                        handleCustomColorChange(field.key, e.target.value)
                      }
                      className="h-8 w-16 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={currentTheme[field.key] as string}
                      onChange={(e) =>
                        handleCustomColorChange(field.key, e.target.value)
                      }
                      className="h-8 flex-1 rounded border border-gray-300 px-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Current Theme Preview */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="mb-2 text-xs font-medium text-gray-600">
          Current Theme: {currentTheme.name}
        </p>
        <div className="flex gap-2">
          <div
            className="h-12 flex-1 rounded border border-gray-200"
            style={{ backgroundColor: currentTheme.primary }}
          />
          <div
            className="h-12 flex-1 rounded border border-gray-200"
            style={{ backgroundColor: currentTheme.secondary }}
          />
          <div
            className="h-12 flex-1 rounded border border-gray-200"
            style={{ backgroundColor: currentTheme.accent }}
          />
        </div>
      </div>
    </div>
  );
}
