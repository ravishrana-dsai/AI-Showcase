'use client';

import { useState, useMemo } from 'react';
import { Prompt, FilterState } from '@/lib/types';
import { buildSearchIndex, searchPrompts } from '@/lib/search';
import { useDebounce } from '@/hooks/useDebounce';
import Header from './Header';
import TabBar, { TabId } from './TabBar';
import SearchBar from './browse/SearchBar';
import FilterPanel from './browse/FilterPanel';
import PromptGrid from './browse/PromptGrid';
import SubmitForm from './submit/SubmitForm';
import PromptGenerator from './generator/PromptGenerator';

interface ClientPageProps {
  initialPrompts: Prompt[];
}

export default function ClientPage({ initialPrompts }: ClientPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    categories: [],
    complexities: [],
    llms: [],
  });

  const debouncedQuery = useDebounce(searchQuery, 300);

  const indexedPrompts = useMemo(() => buildSearchIndex(initialPrompts), [initialPrompts]);

  const filteredPrompts = useMemo(
    () => searchPrompts(indexedPrompts, { ...filters, query: debouncedQuery }),
    [indexedPrompts, filters, debouncedQuery]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} promptCount={initialPrompts.length} />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'browse' && (
          <div className="space-y-6">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <FilterPanel filters={filters} onFilterChange={setFilters} />
            <PromptGrid prompts={filteredPrompts} totalCount={initialPrompts.length} />
          </div>
        )}
        {activeTab === 'submit' && <SubmitForm />}
        {activeTab === 'generator' && <PromptGenerator prompts={initialPrompts} />}
      </main>
    </div>
  );
}
