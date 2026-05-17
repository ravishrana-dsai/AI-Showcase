import type { SlideTemplate, VisualStyle } from '@/lib/templates/types';
import type { SlidePlanItem } from '@/types/generation';
import { getRegistry } from './registry';

export interface TemplateMatch {
  slideIndex: number;
  templateId: string;
  score: number;
}

interface MatchScore {
  templateId: string;
  totalScore: number;
  breakdown: {
    categoryMatch: number;
    subcategoryMatch: number;
    capacityFit: number;
    styleFit: number;
    purposeFit: number;
    tagOverlap: number;
    diversityBonus: number;
  };
}

/**
 * Compute a Jaccard-like similarity between two sets of strings.
 * Returns a value between 0 and 1.
 */
function tagSimilarity(tagsA: string[], tagsB: string[]): number {
  const setA = new Set(tagsA.map((t) => t.toLowerCase()));
  const setB = new Set(tagsB.map((t) => t.toLowerCase()));

  let intersection = 0;
  for (const tag of setA) {
    if (setB.has(tag)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;

  return intersection / union;
}

/**
 * Extract keywords from a purpose/description string.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'shall', 'can',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'this', 'that', 'these', 'those', 'it', 'its', 'and', 'or',
    'but', 'not', 'no', 'so', 'if', 'then', 'than', 'when',
    'what', 'which', 'who', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'about', 'up', 'out', 'just', 'also', 'very', 'as',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

/**
 * Score a single template against a slide plan item.
 */
function computeScore(
  template: SlideTemplate,
  slide: SlidePlanItem,
  userStyle: VisualStyle,
  userPurpose: string,
  selectedTemplateIds: Set<string>
): MatchScore {
  const breakdown = {
    categoryMatch: 0,
    subcategoryMatch: 0,
    capacityFit: 0,
    styleFit: 0,
    purposeFit: 0,
    tagOverlap: 0,
    diversityBonus: 0,
  };

  // 1. Category match (40 points) - MANDATORY
  if (template.category !== slide.category) {
    return { templateId: template.id, totalScore: 0, breakdown };
  }
  breakdown.categoryMatch = 40;

  // 2. Subcategory match (0-15 points)
  if (slide.subcategory && template.subcategory) {
    if (template.subcategory === slide.subcategory) {
      breakdown.subcategoryMatch = 15;
    } else {
      // Partial match - same category family
      breakdown.subcategoryMatch = 5;
    }
  } else if (!slide.subcategory) {
    // No subcategory specified, give a small default
    breakdown.subcategoryMatch = 8;
  }

  // 3. Content capacity fit (0-15 points)
  const densityMap: Record<string, number> = { low: 2, medium: 4, high: 6 };
  const density = densityMap[slide.contentDensity] ?? 4;
  const { minElements, maxElements, idealElements } = template.contentCapacity;

  if (density === idealElements) {
    breakdown.capacityFit = 15;
  } else if (density >= minElements && density <= maxElements) {
    // Within range but not ideal
    const distance = Math.abs(density - idealElements);
    const range = maxElements - minElements;
    const fitRatio = range > 0 ? 1 - distance / range : 1;
    breakdown.capacityFit = Math.round(5 + fitRatio * 10);
  } else {
    // Outside range
    breakdown.capacityFit = 0;
  }

  // 4. Visual style fit (0-10 points)
  if (template.visualStyle === userStyle) {
    breakdown.styleFit = 10;
  } else {
    // Some styles are more compatible than others
    const compatMap: Record<VisualStyle, VisualStyle[]> = {
      minimal: ['corporate'],
      corporate: ['minimal'],
      creative: ['bold'],
      bold: ['creative'],
    };
    if (compatMap[userStyle]?.includes(template.visualStyle)) {
      breakdown.styleFit = 5;
    }
  }

  // 5. Purpose fit (0-10 points)
  if (template.compatiblePurposes.includes(userPurpose)) {
    breakdown.purposeFit = 10;
  }

  // 6. Tag overlap (0-10 points)
  const slideKeywords = extractKeywords(slide.purpose);
  const templateTags = [...template.tags, ...template.useCaseTags];
  const similarity = tagSimilarity(slideKeywords, templateTags);
  breakdown.tagOverlap = Math.round(similarity * 10);

  // 7. Diversity bonus (-5 to +5 points)
  if (selectedTemplateIds.has(template.id)) {
    breakdown.diversityBonus = -5; // Penalize reuse
  } else {
    // Small bonus for variety
    breakdown.diversityBonus = 2;
  }

  const totalScore = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return { templateId: template.id, totalScore, breakdown };
}

/**
 * Match each slide in the plan to the best available template.
 */
export function matchTemplates(
  slidePlan: SlidePlanItem[],
  userStyle: VisualStyle,
  userPurpose: string
): TemplateMatch[] {
  const registry = getRegistry();
  const allTemplates = registry.getAll();
  const selectedTemplateIds = new Set<string>();
  const matches: TemplateMatch[] = [];

  for (const slide of slidePlan) {
    // 1. Get candidates matching the category
    const candidates = allTemplates.filter(
      (t) => t.category === slide.category
    );

    if (candidates.length === 0) {
      // Fallback: try bullet-layout if no template matches the category
      const fallbacks = registry.getByCategory('bullet-layout');
      if (fallbacks.length > 0) {
        matches.push({
          slideIndex: slide.slideIndex,
          templateId: fallbacks[0].id,
          score: 20, // Low score indicates fallback
        });
        selectedTemplateIds.add(fallbacks[0].id);
        continue;
      }
      // Last resort: use first available template
      const first = allTemplates[0];
      if (first) {
        matches.push({
          slideIndex: slide.slideIndex,
          templateId: first.id,
          score: 10,
        });
        selectedTemplateIds.add(first.id);
      }
      continue;
    }

    // 2. Score each candidate
    const scored = candidates.map((template) =>
      computeScore(template, slide, userStyle, userPurpose, selectedTemplateIds)
    );

    // 3. Sort by total score descending
    scored.sort((a, b) => b.totalScore - a.totalScore);

    // 4. Pick the best
    const best = scored[0];
    selectedTemplateIds.add(best.templateId);
    matches.push({
      slideIndex: slide.slideIndex,
      templateId: best.templateId,
      score: best.totalScore,
    });
  }

  return matches;
}

/**
 * Get the template for a specific match result.
 */
export function getMatchedTemplate(
  match: TemplateMatch
): SlideTemplate | undefined {
  return getRegistry().getById(match.templateId);
}
