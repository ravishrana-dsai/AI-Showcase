import { Prompt, ValidationError } from './types';
import { CATEGORIES, COMPLEXITIES } from './constants';

export function validateSubmission(data: Partial<Prompt>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.title?.trim() || data.title.trim().length < 5) {
    errors.push({ field: 'title', message: 'Title must be at least 5 characters' });
  }
  if (data.title && data.title.length > 100) {
    errors.push({ field: 'title', message: 'Title must be under 100 characters' });
  }

  if (!data.primary_use_case?.trim() || data.primary_use_case.trim().length < 10) {
    errors.push({ field: 'primary_use_case', message: 'Primary use case must be at least 10 characters' });
  }

  if (!data.prompt_text?.trim() || data.prompt_text.trim().length < 50) {
    errors.push({ field: 'prompt_text', message: 'Prompt text must be at least 50 characters' });
  }

  if (!data.user_role?.trim()) {
    errors.push({ field: 'user_role', message: 'User role is required' });
  }

  if (!data.industry?.trim()) {
    errors.push({ field: 'industry', message: 'Industry is required' });
  }

  if (!data.output_type?.trim()) {
    errors.push({ field: 'output_type', message: 'Output type is required' });
  }

  if (!data.category || !CATEGORIES.includes(data.category)) {
    errors.push({ field: 'category', message: 'Select a valid category' });
  }

  if (!data.complexity || !COMPLEXITIES.includes(data.complexity)) {
    errors.push({ field: 'complexity', message: 'Select a valid complexity level' });
  }

  if (!data.supported_llms || data.supported_llms.length < 1) {
    errors.push({ field: 'supported_llms', message: 'Select at least 1 supported LLM' });
  }

  if (!data.variations?.short?.trim()) {
    errors.push({ field: 'variations.short', message: 'Short variation is required' });
  }
  if (!data.variations?.detailed?.trim()) {
    errors.push({ field: 'variations.detailed', message: 'Detailed variation is required' });
  }
  if (!data.variations?.strict?.trim()) {
    errors.push({ field: 'variations.strict', message: 'Strict variation is required' });
  }

  if (!data.tips?.trim()) {
    errors.push({ field: 'tips', message: 'Tips are required' });
  }

  return errors;
}
