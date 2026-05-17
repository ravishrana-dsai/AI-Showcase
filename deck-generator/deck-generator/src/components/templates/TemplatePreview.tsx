'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import SlideRenderer from '@/components/preview/SlideRenderer';
import { Badge } from '@/components/ui/Badge';
import type { SlideTemplate } from '@/lib/templates/types';
import { cn } from '@/lib/utils';

interface TemplatePreviewProps {
  template: SlideTemplate | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TemplatePreview({
  template,
  isOpen,
  onClose,
}: TemplatePreviewProps) {
  if (!template) return null;

  // Create placeholder content for preview
  const placeholderContent: Record<string, string> = {};
  template.elements.forEach((el) => {
    if (el.type === 'text' && el.placeholder) {
      placeholderContent[el.id] = el.placeholder.label;
    }
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title={template.name}>
      <div className="space-y-6 -mt-4">
        {/* Description */}
        <p className="text-sm text-gray-600">{template.description}</p>

        {/* Preview */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <SlideRenderer
            template={template}
            content={placeholderContent}
            colorTheme={template.defaultColorTheme}
            className="w-full"
          />
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Metadata */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Template Details</h3>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Category:</span>
                <Badge variant="primary" size="sm">
                  {template.category}
                </Badge>
              </div>

              {template.subcategory && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subcategory:</span>
                  <Badge variant="default" size="sm">
                    {template.subcategory}
                  </Badge>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Visual Style:</span>
                <Badge variant="default" size="sm">
                  {template.visualStyle}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Template ID:</span>
                <span className="font-mono text-xs text-gray-900">
                  {template.id}
                </span>
              </div>
            </div>
          </div>

          {/* Content Capacity */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Content Capacity</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Minimum Elements:</span>
                <span className="font-medium text-gray-900">
                  {template.contentCapacity.minElements}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Ideal Elements:</span>
                <span className="font-medium text-gray-900">
                  {template.contentCapacity.idealElements}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Maximum Elements:</span>
                <span className="font-medium text-gray-900">
                  {template.contentCapacity.maxElements}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="default" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Use Case Tags */}
        {template.useCaseTags.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Use Cases</h3>
            <div className="flex flex-wrap gap-2">
              {template.useCaseTags.map((tag) => (
                <Badge key={tag} variant="default" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Compatible Purposes */}
        {template.compatiblePurposes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Compatible Purposes</h3>
            <div className="flex flex-wrap gap-2">
              {template.compatiblePurposes.map((purpose) => (
                <Badge key={purpose} variant="success" size="sm">
                  {purpose}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
