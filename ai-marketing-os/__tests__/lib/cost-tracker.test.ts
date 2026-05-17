import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateCost } from '@/lib/cost-tracker'

// logCost writes to DB — mock the prisma module so tests stay offline
vi.mock('@/lib/db', () => ({
  prisma: {
    apiCostLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('calculateCost', () => {
  it('calculates cost for claude-sonnet-4-6 correctly', () => {
    // $3/M input, $15/M output
    const cost = calculateCost('claude-sonnet-4-6', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(18.0, 4)
  })

  it('calculates cost for claude-haiku-4-5 correctly', () => {
    // $0.8/M input, $4/M output
    const cost = calculateCost('claude-haiku-4-5', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(4.8, 4)
  })

  it('calculates cost for gemini-2.5-pro correctly', () => {
    // $1.25/M input, $10/M output
    const cost = calculateCost('gemini-2.5-pro', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(11.25, 4)
  })

  it('falls back to gemini pricing for unknown models', () => {
    const cost = calculateCost('unknown-model', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(11.25, 4)
  })

  it('returns 0 for zero tokens', () => {
    expect(calculateCost('claude-sonnet-4-6', 0, 0)).toBe(0)
  })

  it('handles small token counts (typical API call)', () => {
    // 1000 input + 500 output for Sonnet: (3*1000 + 15*500) / 1_000_000
    const cost = calculateCost('claude-sonnet-4-6', 1000, 500)
    expect(cost).toBeCloseTo(0.0105, 6)
  })
})

describe('logCost', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls prisma.apiCostLog.create with correct fields', async () => {
    const { logCost } = await import('@/lib/cost-tracker')
    const { prisma } = await import('@/lib/db')

    await logCost('brand-identity', 'claude-sonnet-4-6', 100, 200, 0.0045)

    expect(prisma.apiCostLog.create).toHaveBeenCalledWith({
      data: {
        agentTab: 'brand-identity',
        model: 'claude-sonnet-4-6',
        inputTokens: 100,
        outputTokens: 200,
        costUsd: 0.0045,
      },
    })
  })
})
