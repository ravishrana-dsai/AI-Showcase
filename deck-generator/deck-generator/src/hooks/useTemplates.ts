'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TemplateCategory, VisualStyle, SlideTemplate } from '@/lib/templates/types';

/**
 * Template summary returned by the API (excludes full elements array).
 */
interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  subcategory?: string;
  visualStyle: VisualStyle;
  tags: string[];
  useCaseTags: string[];
  contentCapacity: {
    minElements: number;
    maxElements: number;
    idealElements: number;
  };
}

interface TemplatesResponse {
  templates: TemplateSummary[];
  count: number;
}

/**
 * Custom hook for browsing and filtering templates.
 * 
 * @returns Object containing templates, loading state, and filter controls
 */
export function useTemplates() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState<TemplateCategory | null>(null);
  const [style, setStyle] = useState<VisualStyle | null>(null);
  const [search, setSearch] = useState<string>('');

  // Fetch templates when filters change
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true);
      
      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (style) params.append('style', style);
        if (search.trim()) params.append('search', search.trim());

        const response = await fetch(`/api/templates?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.statusText}`);
        }

        const data: TemplatesResponse = await response.json();
        setTemplates(data.templates);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setTemplates([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [category, style, search]);

  return {
    templates,
    isLoading,
    category,
    style,
    search,
    setCategory,
    setStyle,
    setSearch,
  };
}
