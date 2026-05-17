'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SlideRenderer from '@/components/preview/SlideRenderer';
import { getRegistry } from '@/lib/templates/registry';
import type { SlideTemplate, TemplateCategory } from '@/lib/templates/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface LayoutSwitcherProps {
  currentTemplateId: string;
  category: TemplateCategory;
  onSwitch: (newTemplateId: string) => void;
  colorTheme: any; // ColorTheme type
}

export default function LayoutSwitcher({
  currentTemplateId,
  category,
  onSwitch,
  colorTheme,
}: LayoutSwitcherProps) {
  const registry = getRegistry();
  const alternatives = useMemo(() => {
    return registry.getByCategory(category).filter((t) => t.id !== currentTemplateId);
  }, [category, currentTemplateId, registry]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const visibleTemplates = alternatives.slice(selectedIndex, selectedIndex + 3);

  const handlePrevious = () => {
    setSelectedIndex(Math.max(0, selectedIndex - 1));
  };

  const handleNext = () => {
    setSelectedIndex(Math.min(alternatives.length - 3, selectedIndex + 1));
  };

  const handleTemplateClick = (template: SlideTemplate) => {
    onSwitch(template.id);
  };

  if (alternatives.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          No alternative templates available in this category.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Alternative Layouts ({alternatives.length})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            disabled={selectedIndex === 0}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNext}
            disabled={selectedIndex >= alternatives.length - 3}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {visibleTemplates.map((template) => {
          // Create placeholder content for preview
          const placeholderContent: Record<string, string> = {};
          template.elements.forEach((el) => {
            if (el.type === 'text' && el.placeholder) {
              placeholderContent[el.id] = el.placeholder.label;
            }
          });

          return (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className={cn(
                'group relative overflow-hidden rounded-lg border-2 transition-all',
                'hover:border-blue-500 hover:shadow-md',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              )}
            >
              <div className="aspect-video">
                <SlideRenderer
                  template={template}
                  content={placeholderContent}
                  colorTheme={colorTheme}
                  scale={0.15}
                  className="pointer-events-none"
                />
              </div>
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
              <div className="absolute bottom-0 left-0 right-0 bg-white/95 p-2 text-left">
                <p className="truncate text-xs font-medium text-gray-900">
                  {template.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {alternatives.length > 3 && (
        <p className="text-xs text-gray-500 text-center">
          Showing {selectedIndex + 1}-{Math.min(selectedIndex + 3, alternatives.length)} of{' '}
          {alternatives.length}
        </p>
      )}
    </div>
  );
}
