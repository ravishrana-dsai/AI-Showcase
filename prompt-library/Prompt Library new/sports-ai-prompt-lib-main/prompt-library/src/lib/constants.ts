import { Category, Complexity, LLM } from './types';

export const CATEGORIES: Category[] = ['Writing', 'Analysis', 'Coding', 'Reasoning', 'Automation', 'Ideation', 'Marketing', 'Social Media', 'Ads', 'Image Creator', 'Graphic Design'];

export const COMPLEXITIES: Complexity[] = ['Beginner', 'Intermediate', 'Advanced'];

export const LLMS: LLM[] = ['Claude', 'GPT-4', 'GPT-5', 'Gemini', 'Llama'];

export const CATEGORY_COLORS: Record<Category, { bg: string; text: string; darkBg: string; darkText: string }> = {
  Writing: { bg: 'bg-blue-100', text: 'text-blue-700', darkBg: 'dark:bg-blue-900/40', darkText: 'dark:text-blue-300' },
  Analysis: { bg: 'bg-green-100', text: 'text-green-700', darkBg: 'dark:bg-green-900/40', darkText: 'dark:text-green-300' },
  Coding: { bg: 'bg-purple-100', text: 'text-purple-700', darkBg: 'dark:bg-purple-900/40', darkText: 'dark:text-purple-300' },
  Reasoning: { bg: 'bg-orange-100', text: 'text-orange-700', darkBg: 'dark:bg-orange-900/40', darkText: 'dark:text-orange-300' },
  Automation: { bg: 'bg-red-100', text: 'text-red-700', darkBg: 'dark:bg-red-900/40', darkText: 'dark:text-red-300' },
  Ideation: { bg: 'bg-yellow-100', text: 'text-yellow-700', darkBg: 'dark:bg-yellow-900/40', darkText: 'dark:text-yellow-300' },
  Marketing: { bg: 'bg-pink-100', text: 'text-pink-700', darkBg: 'dark:bg-pink-900/40', darkText: 'dark:text-pink-300' },
  'Social Media': { bg: 'bg-cyan-100', text: 'text-cyan-700', darkBg: 'dark:bg-cyan-900/40', darkText: 'dark:text-cyan-300' },
  Ads: { bg: 'bg-indigo-100', text: 'text-indigo-700', darkBg: 'dark:bg-indigo-900/40', darkText: 'dark:text-indigo-300' },
  'Image Creator': { bg: 'bg-violet-100', text: 'text-violet-700', darkBg: 'dark:bg-violet-900/40', darkText: 'dark:text-violet-300' },
  'Graphic Design': { bg: 'bg-teal-100', text: 'text-teal-700', darkBg: 'dark:bg-teal-900/40', darkText: 'dark:text-teal-300' },
};

export const COMPLEXITY_COLORS: Record<Complexity, { bg: string; text: string; darkBg: string; darkText: string }> = {
  Beginner: { bg: 'bg-emerald-100', text: 'text-emerald-700', darkBg: 'dark:bg-emerald-900/40', darkText: 'dark:text-emerald-300' },
  Intermediate: { bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'dark:bg-amber-900/40', darkText: 'dark:text-amber-300' },
  Advanced: { bg: 'bg-rose-100', text: 'text-rose-700', darkBg: 'dark:bg-rose-900/40', darkText: 'dark:text-rose-300' },
};
