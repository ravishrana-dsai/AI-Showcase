export type Category = 'Writing' | 'Analysis' | 'Coding' | 'Reasoning' | 'Automation' | 'Ideation' | 'Marketing' | 'Social Media' | 'Ads' | 'Image Creator' | 'Graphic Design';
export type Complexity = 'Beginner' | 'Intermediate' | 'Advanced';
export type LLM = 'Claude' | 'GPT-4' | 'GPT-5' | 'Gemini' | 'Llama';

export interface PromptVariations {
  short: string;
  detailed: string;
  strict: string;
}

export interface Prompt {
  prompt_id: string;
  title: string;
  primary_use_case: string;
  secondary_use_cases: string[];
  user_role: string;
  industry: string;
  category: Category;
  complexity: Complexity;
  supported_llms: LLM[];
  output_type: string;
  prompt_text: string;
  variations: PromptVariations;
  tips: string;
}

export interface FilterState {
  query: string;
  categories: Category[];
  complexities: Complexity[];
  llms: LLM[];
}

export interface Submission extends Prompt {
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ValidationError {
  field: string;
  message: string;
}
