'use client';

import { useState } from 'react';
import { Category, Complexity, LLM, ValidationError } from '@/lib/types';
import { CATEGORIES, COMPLEXITIES, LLMS } from '@/lib/constants';
import { validateSubmission } from '@/lib/validation';
import ArrayInput from './ArrayInput';

export default function SubmitForm() {
  const [title, setTitle] = useState('');
  const [primaryUseCase, setPrimaryUseCase] = useState('');
  const [secondaryUseCases, setSecondaryUseCases] = useState<string[]>(['']);
  const [userRole, setUserRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [complexity, setComplexity] = useState<Complexity | ''>('');
  const [supportedLlms, setSupportedLlms] = useState<LLM[]>([...LLMS]);
  const [outputType, setOutputType] = useState('');
  const [promptText, setPromptText] = useState('');
  const [variationShort, setVariationShort] = useState('');
  const [variationDetailed, setVariationDetailed] = useState('');
  const [variationStrict, setVariationStrict] = useState('');
  const [tips, setTips] = useState('');

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const getError = (field: string) => errors.find((e) => e.field === field)?.message;

  const toggleLlm = (llm: LLM) => {
    setSupportedLlms((prev) =>
      prev.includes(llm) ? prev.filter((l) => l !== llm) : [...prev, llm]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      title: title.trim(),
      primary_use_case: primaryUseCase.trim(),
      secondary_use_cases: secondaryUseCases.filter((s) => s.trim()),
      user_role: userRole.trim(),
      industry: industry.trim(),
      category: category as Category,
      complexity: complexity as Complexity,
      supported_llms: supportedLlms,
      output_type: outputType.trim(),
      prompt_text: promptText.trim(),
      variations: {
        short: variationShort.trim(),
        detailed: variationDetailed.trim(),
        strict: variationStrict.trim(),
      },
      tips: tips.trim(),
    };

    const validationErrors = validateSubmission(data);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setSubmitting(true);

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setErrors(body.errors || [{ field: 'general', message: 'Submission failed' }]);
        return;
      }

      setSubmitted(true);
    } catch {
      setErrors([{ field: 'general', message: 'Network error. Please try again.' }]);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg glass text-foreground placeholder:text-muted/50 focus:outline-none input-glow text-sm';

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-gradient">Prompt Submitted!</h2>
        <p className="text-muted mb-6">Your prompt has been submitted for review.</p>
        <button
          onClick={() => {
            setSubmitted(false);
            setTitle('');
            setPrimaryUseCase('');
            setSecondaryUseCases(['']);
            setUserRole('');
            setIndustry('');
            setCategory('');
            setComplexity('');
            setSupportedLlms([...LLMS]);
            setOutputType('');
            setPromptText('');
            setVariationShort('');
            setVariationDetailed('');
            setVariationStrict('');
            setTips('');
          }}
          className="px-6 py-2.5 rounded-xl btn-gradient text-sm font-medium transition-all"
        >
          <span className="relative z-10">Submit Another</span>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2 text-gradient">Submit a Prompt</h2>
        <p className="text-muted text-sm">Share your best prompts with the community.</p>
      </div>

      {getError('general') && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {getError('general')}
        </div>
      )}

      {/* Basic Info */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gradient">Basic Information</h3>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Professional Email Composer"
            className={inputClass}
          />
          {getError('title') && <p className="mt-1 text-xs text-red-500">{getError('title')}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className={inputClass}
            >
              <option value="">Select category...</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {getError('category') && <p className="mt-1 text-xs text-red-500">{getError('category')}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Complexity</label>
            <select
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as Complexity)}
              className={inputClass}
            >
              <option value="">Select complexity...</option>
              {COMPLEXITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {getError('complexity') && <p className="mt-1 text-xs text-red-500">{getError('complexity')}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">User Role</label>
            <input
              type="text"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              placeholder="e.g., Product Manager"
              className={inputClass}
            />
            {getError('user_role') && <p className="mt-1 text-xs text-red-500">{getError('user_role')}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Industry</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g., Technology"
              className={inputClass}
            />
            {getError('industry') && <p className="mt-1 text-xs text-red-500">{getError('industry')}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Output Type</label>
            <input
              type="text"
              value={outputType}
              onChange={(e) => setOutputType(e.target.value)}
              placeholder="e.g., Text, Code"
              className={inputClass}
            />
            {getError('output_type') && <p className="mt-1 text-xs text-red-500">{getError('output_type')}</p>}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gradient">Use Cases</h3>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Primary Use Case</label>
          <input
            type="text"
            value={primaryUseCase}
            onChange={(e) => setPrimaryUseCase(e.target.value)}
            placeholder="Describe the main purpose of this prompt"
            className={inputClass}
          />
          {getError('primary_use_case') && <p className="mt-1 text-xs text-red-500">{getError('primary_use_case')}</p>}
        </div>
        <ArrayInput
          label="Secondary Use Cases"
          values={secondaryUseCases}
          onChange={setSecondaryUseCases}
          placeholder="Additional use case"
          error={getError('secondary_use_cases')}
        />
      </section>

      {/* Prompt Text */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gradient">Prompt Text</h3>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Main Prompt</label>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Write the full, production-ready prompt..."
            rows={8}
            className={inputClass}
          />
          {getError('prompt_text') && <p className="mt-1 text-xs text-red-500">{getError('prompt_text')}</p>}
          <p className="mt-1 text-xs text-muted">{promptText.length} characters (minimum 50)</p>
        </div>
      </section>

      {/* Variations */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gradient">Variations</h3>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Short Variation</label>
          <textarea
            value={variationShort}
            onChange={(e) => setVariationShort(e.target.value)}
            placeholder="A concise, quick version of the prompt"
            rows={3}
            className={inputClass}
          />
          {getError('variations.short') && <p className="mt-1 text-xs text-red-500">{getError('variations.short')}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Detailed Variation</label>
          <textarea
            value={variationDetailed}
            onChange={(e) => setVariationDetailed(e.target.value)}
            placeholder="A comprehensive version with full specifications"
            rows={3}
            className={inputClass}
          />
          {getError('variations.detailed') && <p className="mt-1 text-xs text-red-500">{getError('variations.detailed')}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Strict Variation</label>
          <textarea
            value={variationStrict}
            onChange={(e) => setVariationStrict(e.target.value)}
            placeholder="A rigid version with exact requirements and constraints"
            rows={3}
            className={inputClass}
          />
          {getError('variations.strict') && <p className="mt-1 text-xs text-red-500">{getError('variations.strict')}</p>}
        </div>
      </section>

      {/* Additional */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gradient">Additional</h3>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Supported LLMs</label>
          <div className="flex flex-wrap gap-2">
            {LLMS.map((llm) => (
              <button
                key={llm}
                type="button"
                onClick={() => toggleLlm(llm)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  supportedLlms.includes(llm)
                    ? 'btn-gradient shadow-sm'
                    : 'glass text-muted hover:text-foreground glow-hover'
                }`}
              >
                <span className="relative z-10">{llm}</span>
              </button>
            ))}
          </div>
          {getError('supported_llms') && <p className="mt-1 text-xs text-red-500">{getError('supported_llms')}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Tips for Best Results</label>
          <textarea
            value={tips}
            onChange={(e) => setTips(e.target.value)}
            placeholder="Share tips or best practices for using this prompt effectively"
            rows={3}
            className={inputClass}
          />
        </div>
      </section>

      {/* Submit */}
      <div className="pt-6" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-8 py-3 rounded-xl btn-gradient text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="relative z-10">{submitting ? 'Submitting...' : 'Submit Prompt'}</span>
        </button>
      </div>
    </form>
  );
}
