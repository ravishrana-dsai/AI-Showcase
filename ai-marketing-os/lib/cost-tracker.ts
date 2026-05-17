import { prisma } from './db'

// Pricing per 1M tokens (USD)
const CLAUDE_SONNET_PRICING = { input: 3.0,  output: 15.0 }
const CLAUDE_HAIKU_PRICING  = { input: 0.8,  output: 4.0  }
const GEMINI_25_PRO_PRICING = { input: 1.25, output: 10.0 }

function getPricing(model: string) {
  if (model === 'claude-sonnet-4-6') return CLAUDE_SONNET_PRICING
  if (model === 'claude-haiku-4-5')  return CLAUDE_HAIKU_PRICING
  return GEMINI_25_PRO_PRICING
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getPricing(model)
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

export async function logCost(
  agentTab: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  costUsd: number
): Promise<void> {
  await prisma.apiCostLog.create({
    data: { agentTab, model, inputTokens, outputTokens, costUsd },
  })
}

// Re-export from format.ts for server-side convenience
export { formatCost } from './format'
