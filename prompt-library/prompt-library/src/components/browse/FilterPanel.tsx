'use client';

import { Category, Complexity, LLM, FilterState } from '@/lib/types';
import { CATEGORIES, COMPLEXITIES, LLMS, CATEGORY_COLORS, COMPLEXITY_COLORS } from '@/lib/constants';

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

function ChipGroup<T extends string>({
  label,
  items,
  selected,
  onToggle,
  getColors,
}: {
  label: string;
  items: T[];
  selected: T[];
  onToggle: (item: T) => void;
  getColors?: (item: T) => { bg: string; text: string; darkBg: string; darkText: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted min-w-[80px]">{label}</span>
      {items.map((item) => {
        const isActive = selected.includes(item);
        const colors = getColors?.(item);
        return (
          <button
            key={item}
            onClick={() => onToggle(item)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              isActive && colors
                ? `${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText} shadow-sm`
                : isActive
                ? 'btn-gradient shadow-sm'
                : 'glass text-muted hover:text-foreground glow-hover'
            }`}
          >
            {isActive && !colors ? <span className="relative z-10">{item}</span> : item}
          </button>
        );
      })}
    </div>
  );
}

export default function FilterPanel({ filters, onFilterChange }: FilterPanelProps) {
  const toggleCategory = (cat: Category) => {
    const next = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    onFilterChange({ ...filters, categories: next });
  };

  const toggleComplexity = (comp: Complexity) => {
    const next = filters.complexities.includes(comp)
      ? filters.complexities.filter((c) => c !== comp)
      : [...filters.complexities, comp];
    onFilterChange({ ...filters, complexities: next });
  };

  const toggleLlm = (llm: LLM) => {
    const next = filters.llms.includes(llm)
      ? filters.llms.filter((l) => l !== llm)
      : [...filters.llms, llm];
    onFilterChange({ ...filters, llms: next });
  };

  const hasActiveFilters =
    filters.categories.length > 0 || filters.complexities.length > 0 || filters.llms.length > 0;

  return (
    <div className="space-y-3 p-4 rounded-xl glass">
      <ChipGroup
        label="Category"
        items={CATEGORIES}
        selected={filters.categories}
        onToggle={toggleCategory}
        getColors={(cat) => CATEGORY_COLORS[cat]}
      />
      <ChipGroup
        label="Complexity"
        items={COMPLEXITIES}
        selected={filters.complexities}
        onToggle={toggleComplexity}
        getColors={(comp) => COMPLEXITY_COLORS[comp]}
      />
      <ChipGroup label="LLM" items={LLMS} selected={filters.llms} onToggle={toggleLlm} />
      {hasActiveFilters && (
        <button
          onClick={() => onFilterChange({ ...filters, categories: [], complexities: [], llms: [] })}
          className="text-xs text-gradient hover:opacity-80 transition-opacity"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
