// Pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-opus-4":              { input: 15.00, output: 75.00 },
  "claude-sonnet-4":            { input: 3.00,  output: 15.00 },
  "claude-sonnet-4-20250514":   { input: 3.00,  output: 15.00 },
  "claude-haiku-4":             { input: 0.80,  output: 4.00  },
  "claude-3-5-sonnet-20241022": { input: 3.00,  output: 15.00 },
  "claude-3-haiku-20240307":    { input: 0.25,  output: 1.25  },
  // OpenAI
  "gpt-4o":                     { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":                { input: 0.15,  output: 0.60  },
  "gpt-4-turbo":                { input: 10.00, output: 30.00 },
  "gpt-3.5-turbo":              { input: 0.50,  output: 1.50  },
  // Google Gemini
  "gemini-2.0-flash":           { input: 0.10,  output: 0.40  },
  "gemini-2.0-flash-exp":       { input: 0.10,  output: 0.40  },
  "gemini-1.5-pro":             { input: 1.25,  output: 5.00  },
  "gemini-1.5-flash":           { input: 0.075, output: 0.30  },
  "gemini-1.5-flash-8b":        { input: 0.0375,output: 0.15  },
  // Cohere
  "command-r-plus":             { input: 2.50,  output: 10.00 },
  "command-r":                  { input: 0.15,  output: 0.60  },
};

const FALLBACK_PRICING = { input: 1.00, output: 4.00 };

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] ?? PRICING[model.split("-").slice(0, 3).join("-")] ?? FALLBACK_PRICING;
  const inputCost  = (inputTokens  / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export function detectFlags(
  model: string,
  inputTokens: number,
  cacheHit: boolean,
  isBatched: boolean,
  feature: string
): string[] {
  const flags: string[] = [];
  if (inputTokens > 2000 && !cacheHit) flags.push("static_prompt_not_cached");
  if (model.includes("opus") && inputTokens < 500) flags.push("overmodeled");
  if (!isBatched && feature?.includes("analysis")) flags.push("should_batch");
  if (model.includes("gpt-4-turbo")) flags.push("consider_gpt4o");
  if (model.includes("gemini-1.5-pro") && inputTokens < 1000) flags.push("use_flash_instead");
  return flags;
}

export { PRICING };
