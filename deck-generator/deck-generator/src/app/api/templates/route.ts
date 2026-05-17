import { NextRequest, NextResponse } from 'next/server';
import { getRegistry } from '@/lib/templates/registry';
import type { TemplateFilterCriteria } from '@/lib/templates/registry';
import type { TemplateCategory, VisualStyle } from '@/lib/templates/types';

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const category = searchParams.get('category') as TemplateCategory | null;
    const style = searchParams.get('style') as VisualStyle | null;
    const purpose = searchParams.get('purpose') || undefined;
    const search = searchParams.get('search') || undefined;
    const subcategory = searchParams.get('subcategory') || undefined;

    // Build filter criteria
    const filters: TemplateFilterCriteria = {};
    if (category) filters.category = category;
    if (style) filters.style = style;
    if (purpose) filters.purpose = purpose;
    if (search) filters.search = search;
    if (subcategory) filters.subcategory = subcategory;

    // Get filtered templates
    const registry = getRegistry();
    const templates = registry.getFiltered(filters);

    // Map to summary objects (exclude elements array)
    const summaries: TemplateSummary[] = templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      subcategory: template.subcategory,
      visualStyle: template.visualStyle,
      tags: template.tags,
      useCaseTags: template.useCaseTags,
      contentCapacity: template.contentCapacity,
    }));

    return NextResponse.json({
      templates: summaries,
      count: summaries.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch templates', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
