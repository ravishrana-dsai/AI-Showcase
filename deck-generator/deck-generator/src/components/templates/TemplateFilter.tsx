'use client';

import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import type { TemplateCategory, VisualStyle } from '@/lib/templates/types';

interface TemplateFilterProps {
  category: TemplateCategory | '';
  style: VisualStyle | '';
  search: string;
  onCategoryChange: (category: TemplateCategory | '') => void;
  onStyleChange: (style: VisualStyle | '') => void;
  onSearchChange: (search: string) => void;
}

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Categories' },
  { value: 'title', label: 'Title' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'process-flow', label: 'Process Flow' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'chart', label: 'Chart' },
  { value: 'team', label: 'Team' },
  { value: 'swot', label: 'SWOT' },
  { value: 'closing', label: 'Closing' },
  { value: 'quote', label: 'Quote' },
  { value: 'metrics-kpi', label: 'Metrics & KPI' },
  { value: 'icon-layout', label: 'Icon Layout' },
  { value: 'image-layout', label: 'Image Layout' },
  { value: 'bullet-layout', label: 'Bullet Layout' },
  { value: 'hierarchy', label: 'Hierarchy' },
  { value: 'venn', label: 'Venn' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'funnel', label: 'Funnel' },
  { value: 'roadmap', label: 'Roadmap' },
  { value: 'feature-highlight', label: 'Feature Highlight' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'section-divider', label: 'Section Divider' },
];

const STYLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Styles' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'creative', label: 'Creative' },
  { value: 'bold', label: 'Bold' },
];

export default function TemplateFilter({
  category,
  style,
  search,
  onCategoryChange,
  onStyleChange,
  onSearchChange,
}: TemplateFilterProps) {
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Filter className="h-5 w-5 text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-900">Filter Templates</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Category Filter */}
        <Select
          label="Category"
          value={category}
          onChange={(e) =>
            onCategoryChange((e.target.value as TemplateCategory) || '')
          }
          options={CATEGORY_OPTIONS}
        />

        {/* Style Filter */}
        <Select
          label="Visual Style"
          value={style}
          onChange={(e) => onStyleChange((e.target.value as VisualStyle) || '')}
          options={STYLE_OPTIONS}
        />

        {/* Search */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search templates..."
              className="pl-10"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
