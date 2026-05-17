'use client';

import React from 'react';
import TemplateCard from './TemplateCard';
import type { SlideTemplate } from '@/lib/templates/types';
import { cn } from '@/lib/utils';

interface TemplateGalleryProps {
  templates: SlideTemplate[];
  onSelectTemplate?: (template: SlideTemplate) => void;
}

export default function TemplateGallery({
  templates,
  onSelectTemplate,
}: TemplateGalleryProps) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">No templates found</p>
          <p className="mt-2 text-sm text-gray-500">
            Try adjusting your filters to see more templates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onClick={() => onSelectTemplate?.(template)}
        />
      ))}
    </div>
  );
}
