import type {
  SlideTemplate,
  TemplateCategory,
  VisualStyle,
} from '@/lib/templates/types';
import { validateTemplate } from '@/lib/templates/validate';
import type { ValidationIssue } from '@/lib/templates/validate';

export interface TemplateFilterCriteria {
  category?: TemplateCategory;
  style?: VisualStyle;
  purpose?: string;
  search?: string;
  subcategory?: string;
}

class TemplateRegistry {
  private templates: Map<string, SlideTemplate> = new Map();
  private byCategory: Map<TemplateCategory, SlideTemplate[]> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  constructor(allTemplates: SlideTemplate[]) {
    // --- Template Validation (development only) ---
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const allIssues: ValidationIssue[] = [];
      for (const template of allTemplates) {
        const issues = validateTemplate(template);
        allIssues.push(...issues);
      }

      const errors = allIssues.filter((i) => i.severity === 'error');
      const warnings = allIssues.filter((i) => i.severity === 'warning');

      for (const issue of warnings) {
        console.warn(
          `[Template Validation] ⚠ ${issue.templateId}${issue.elementId ? ` > ${issue.elementId}` : ''}: ${issue.message}`
        );
      }
      for (const issue of errors) {
        console.error(
          `[Template Validation] ✖ ${issue.templateId}${issue.elementId ? ` > ${issue.elementId}` : ''}: ${issue.message}`
        );
      }

      console.log(
        `[Template Validation] ${allTemplates.length} templates loaded, ${allIssues.length} issues found (${errors.length} errors, ${warnings.length} warnings)`
      );
    }

    for (const template of allTemplates) {
      this.templates.set(template.id, template);

      // Index by category
      const categoryList = this.byCategory.get(template.category) || [];
      categoryList.push(template);
      this.byCategory.set(template.category, categoryList);

      // Index by tags
      const allTags = [
        ...template.tags,
        ...template.useCaseTags,
        template.category,
        template.visualStyle,
        ...(template.subcategory ? [template.subcategory] : []),
      ];

      for (const tag of allTags) {
        const normalizedTag = tag.toLowerCase();
        if (!this.tagIndex.has(normalizedTag)) {
          this.tagIndex.set(normalizedTag, new Set());
        }
        this.tagIndex.get(normalizedTag)!.add(template.id);
      }
    }
  }

  getById(id: string): SlideTemplate | undefined {
    return this.templates.get(id);
  }

  getByCategory(category: TemplateCategory): SlideTemplate[] {
    return this.byCategory.get(category) || [];
  }

  searchByTags(tags: string[]): SlideTemplate[] {
    const matchingIds = new Set<string>();

    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase();
      const ids = this.tagIndex.get(normalizedTag);
      if (ids) {
        for (const id of ids) {
          matchingIds.add(id);
        }
      }
    }

    return Array.from(matchingIds)
      .map((id) => this.templates.get(id)!)
      .filter(Boolean);
  }

  getAll(): SlideTemplate[] {
    return Array.from(this.templates.values());
  }

  getFiltered(filters: TemplateFilterCriteria): SlideTemplate[] {
    let results = this.getAll();

    if (filters.category) {
      results = results.filter((t) => t.category === filters.category);
    }

    if (filters.style) {
      results = results.filter((t) => t.visualStyle === filters.style);
    }

    if (filters.purpose) {
      results = results.filter((t) =>
        t.compatiblePurposes.includes(filters.purpose!)
      );
    }

    if (filters.subcategory) {
      results = results.filter((t) => t.subcategory === filters.subcategory);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(searchLower)) ||
          t.useCaseTags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    return results;
  }

  getCategories(): TemplateCategory[] {
    return Array.from(this.byCategory.keys());
  }

  getCategoryCount(category: TemplateCategory): number {
    return (this.byCategory.get(category) || []).length;
  }

  getTotalCount(): number {
    return this.templates.size;
  }
}

// Singleton instance - will be populated when templates are loaded
let registryInstance: TemplateRegistry | null = null;

export function initializeRegistry(templates: SlideTemplate[]): TemplateRegistry {
  registryInstance = new TemplateRegistry(templates);
  return registryInstance;
}

export function getRegistry(): TemplateRegistry {
  if (!registryInstance) {
    // Lazy-load templates
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { allTemplates } = require('@/data/templates');
    registryInstance = new TemplateRegistry(allTemplates);
  }
  return registryInstance;
}

export { TemplateRegistry };
