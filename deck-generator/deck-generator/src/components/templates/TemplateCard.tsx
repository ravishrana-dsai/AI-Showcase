'use client';

import React from 'react';
import { motion } from 'framer-motion';
import SlideRenderer from '@/components/preview/SlideRenderer';
import { Badge } from '@/components/ui/Badge';
import type { SlideTemplate } from '@/lib/templates/types';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  template: SlideTemplate;
  onClick?: () => void;
}

export default function TemplateCard({ template, onClick }: TemplateCardProps) {
  // Create placeholder content for preview
  const placeholderContent: Record<string, string> = {};
  template.elements.forEach((el) => {
    if (el.type === 'text' && el.placeholder) {
      placeholderContent[el.id] = el.placeholder.label;
    }
  });

  const styleVariants = {
    minimal: 'bg-gray-50',
    corporate: 'bg-blue-50',
    creative: 'bg-purple-50',
    bold: 'bg-orange-50',
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="group"
    >
      <button
        onClick={onClick}
        className={cn(
          'relative w-full overflow-hidden rounded-xl border-2 border-gray-200 bg-white',
          'transition-all hover:border-blue-500 hover:shadow-lg',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        )}
      >
        {/* Preview */}
        <div className="aspect-video overflow-hidden bg-gray-100">
          <SlideRenderer
            template={template}
            content={placeholderContent}
            colorTheme={template.defaultColorTheme}
            scale={0.2}
            className="pointer-events-none"
          />
        </div>

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Content */}
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="text-left text-sm font-semibold text-gray-900 line-clamp-1">
              {template.name}
            </h3>
          </div>

          <p className="mb-3 line-clamp-2 text-left text-xs text-gray-600">
            {template.description}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary" size="sm">
              {template.category}
            </Badge>
            <Badge
              variant="default"
              size="sm"
              className={cn(styleVariants[template.visualStyle])}
            >
              {template.visualStyle}
            </Badge>
            {template.subcategory && (
              <Badge variant="default" size="sm">
                {template.subcategory}
              </Badge>
            )}
          </div>

          {/* Tags */}
          {template.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {template.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-gray-500"
                >
                  #{tag}
                </span>
              ))}
              {template.tags.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{template.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Content capacity */}
          <div className="mt-3 border-t border-gray-100 pt-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Capacity:</span>
              <span>
                {template.contentCapacity.minElements}-
                {template.contentCapacity.maxElements} elements
              </span>
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}
