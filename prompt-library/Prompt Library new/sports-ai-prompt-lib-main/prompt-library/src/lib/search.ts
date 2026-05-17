import { Prompt, FilterState } from './types';

export interface IndexedPrompt extends Prompt {
  _searchText: string;
}

export interface ScoredPrompt extends Prompt {
  relevanceScore: number;
}

export function buildSearchIndex(prompts: Prompt[]): IndexedPrompt[] {
  return prompts.map(p => ({
    ...p,
    _searchText: [
      p.title,
      p.primary_use_case,
      p.secondary_use_cases.join(' '),
      p.user_role,
      p.industry,
      p.category,
      p.output_type,
      p.prompt_text,
      p.tips,
    ].join(' ').toLowerCase(),
  }));
}

export function searchPrompts(prompts: IndexedPrompt[], filters: FilterState): IndexedPrompt[] {
  let results = prompts;

  if (filters.categories.length > 0) {
    results = results.filter(p => filters.categories.includes(p.category));
  }

  if (filters.complexities.length > 0) {
    results = results.filter(p => filters.complexities.includes(p.complexity));
  }

  if (filters.llms.length > 0) {
    results = results.filter(p => p.supported_llms.some(l => filters.llms.includes(l)));
  }

  if (filters.query.trim()) {
    const terms = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
    results = results.filter(prompt =>
      terms.every(term => prompt._searchText.includes(term))
    );
  }

  return results;
}

/**
 * Scores and ranks prompts by relevance to a free-text query.
 * Uses weighted term matching across different prompt fields.
 */
export function findBestPrompts(
  prompts: Prompt[],
  query: string,
  limit: number = 10,
): ScoredPrompt[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  // Field weights: higher = more important for relevance
  const weights = {
    title: 10,
    primary_use_case: 8,
    secondary_use_cases: 6,
    category: 5,
    user_role: 4,
    industry: 4,
    output_type: 3,
    prompt_text: 1,
    tips: 1,
  };

  const scored: ScoredPrompt[] = prompts.map(prompt => {
    let score = 0;

    const fields: { text: string; weight: number }[] = [
      { text: prompt.title.toLowerCase(), weight: weights.title },
      { text: prompt.primary_use_case.toLowerCase(), weight: weights.primary_use_case },
      { text: prompt.secondary_use_cases.join(' ').toLowerCase(), weight: weights.secondary_use_cases },
      { text: prompt.category.toLowerCase(), weight: weights.category },
      { text: prompt.user_role.toLowerCase(), weight: weights.user_role },
      { text: prompt.industry.toLowerCase(), weight: weights.industry },
      { text: prompt.output_type.toLowerCase(), weight: weights.output_type },
      { text: prompt.prompt_text.toLowerCase(), weight: weights.prompt_text },
      { text: prompt.tips.toLowerCase(), weight: weights.tips },
    ];

    for (const term of terms) {
      for (const field of fields) {
        if (field.text.includes(term)) {
          score += field.weight;
        }
      }
    }

    return { ...prompt, relevanceScore: score };
  });

  return scored
    .filter(p => p.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}
