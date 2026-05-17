'use client';

import React, { useState, useMemo } from 'react';
import { Layers, Search } from 'lucide-react';
import TemplateGallery from '@/components/templates/TemplateGallery';
import TemplateFilter from '@/components/templates/TemplateFilter';
import TemplatePreview from '@/components/templates/TemplatePreview';
import { allTemplates } from '@/data/templates';
import type { SlideTemplate, TemplateCategory, VisualStyle } from '@/lib/templates/types';
import { Spinner } from '@/components/ui/Spinner';

export default function TemplatesPage() {
  const [category, setCategory] = useState<TemplateCategory | ''>('');
  const [style, setStyle] = useState<VisualStyle | ''>('');
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<SlideTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Filter templates client-side
  const filteredTemplates = useMemo(() => {
    let results = allTemplates;

    if (category) {
      results = results.filter((t) => t.category === category);
    }

    if (style) {
      results = results.filter((t) => t.visualStyle === style);
    }

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(searchLower)) ||
          t.useCaseTags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    return results;
  }, [category, style, search]);

  const handleTemplateSelect = (template: SlideTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    setSelectedTemplate(null);
  };

  return (
    <div className="flex min-h-screen flex-col">

      <main className="flex-1 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Layers className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Template Gallery
              </h1>
            </div>
            <p className="mt-2 text-lg text-gray-600">
              Browse our collection of professionally designed presentation templates
            </p>
          </div>

          {/* Filter Bar */}
          <div className="mb-8">
            <TemplateFilter
              category={category}
              style={style}
              search={search}
              onCategoryChange={setCategory}
              onStyleChange={setStyle}
              onSearchChange={setSearch}
            />
          </div>

          {/* Results Count */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredTemplates.length === 1
                ? '1 template found'
                : `${filteredTemplates.length} templates found`}
            </p>
          </div>

          {/* Template Gallery */}
          <TemplateGallery
            templates={filteredTemplates}
            onSelectTemplate={handleTemplateSelect}
          />
        </div>
      </main>

      {/* Template Preview Modal */}
      <TemplatePreview
        template={selectedTemplate}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
      />
    </div>
  );
}
