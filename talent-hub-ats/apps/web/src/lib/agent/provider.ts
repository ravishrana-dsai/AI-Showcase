export type AgentStep =
  | "linkedin_sourcing"
  | "company_intel"
  | "jd_polish"
  | "candidate_matching"
  | "email_drafting"
  | "interview_prep";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface StreamParams {
  system: string;
  userMessage: string;
  tools?: ToolDefinition[];
  onToolCall: (name: string, input: unknown) => Promise<unknown>;
  onText: (chunk: string) => void;
}

export interface LLMProvider {
  stream(params: StreamParams): Promise<void>;
}
