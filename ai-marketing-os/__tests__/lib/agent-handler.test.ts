import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAgentRoute } from '@/lib/agent-handler'

// Mock all external dependencies
vi.mock('@/lib/ai', () => ({
  generateContent: vi.fn(),
}))
vi.mock('@/lib/brain', () => ({
  getContextAsString: vi.fn(),
  saveOutput: vi.fn(),
}))
vi.mock('@/lib/insight-extractor', () => ({
  extractInsights: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    agentOutput: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { generateContent } from '@/lib/ai'
import { getContextAsString, saveOutput } from '@/lib/brain'
import { prisma } from '@/lib/db'

const mockPromptBuilder = (ctx: string) => `System: ${ctx}`

function makePostRequest(body: unknown, ip = '1.2.3.4') {
  return new Request('http://localhost/api/agents/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(params = '') {
  return new Request(`http://localhost/api/agents/test${params}`)
}

function makePatchRequest(body: unknown, ip = '1.2.3.4') {
  return new Request('http://localhost/api/agents/test', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('createAgentRoute — GET', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns outputs from the database', async () => {
    const fakeOutputs = [{ id: '1', outputContent: 'hello' }]
    vi.mocked(prisma.agentOutput.findMany).mockResolvedValue(fakeOutputs as never)

    const { GET } = createAgentRoute('brand-identity', mockPromptBuilder)
    const res = await GET(makeGetRequest())
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual(fakeOutputs)
  })

  it('caps limit at 50', async () => {
    vi.mocked(prisma.agentOutput.findMany).mockResolvedValue([])
    const { GET } = createAgentRoute('brand-identity', mockPromptBuilder)
    await GET(makeGetRequest('?limit=999'))

    expect(prisma.agentOutput.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })

  it('returns empty array on DB error', async () => {
    vi.mocked(prisma.agentOutput.findMany).mockRejectedValue(new Error('DB down'))
    const { GET } = createAgentRoute('brand-identity', mockPromptBuilder)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('createAgentRoute — POST', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when prompt is missing', async () => {
    const { POST } = createAgentRoute('brand-identity', mockPromptBuilder)
    const res = await POST(makePostRequest({ prompt: '' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Prompt is required')
  })

  it('returns 400 when prompt is whitespace only', async () => {
    const { POST } = createAgentRoute('brand-identity', mockPromptBuilder)
    const res = await POST(makePostRequest({ prompt: '   ' }))
    expect(res.status).toBe(400)
  })

  it('generates content and saves output on valid prompt', async () => {
    vi.mocked(getContextAsString).mockResolvedValue('brand context')
    vi.mocked(generateContent).mockResolvedValue({
      content: 'Generated text',
      model: 'claude-sonnet-4-6',
      inputTokens: 100,
      outputTokens: 200,
      costUsd: 0.005,
    })
    vi.mocked(saveOutput).mockResolvedValue({ id: 'out-1' } as never)

    const { POST } = createAgentRoute('brand-identity', mockPromptBuilder)
    const res = await POST(makePostRequest({ prompt: 'Write a brand brief' }, '2.2.2.2'))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.content).toBe('Generated text')
    expect(data.outputId).toBe('out-1')
    expect(saveOutput).toHaveBeenCalledWith(
      expect.objectContaining({ agentTab: 'brand-identity', inputPrompt: 'Write a brand brief' })
    )
  })

  it('returns 429 after exceeding rate limit', async () => {
    const { POST } = createAgentRoute('brand-identity-rl', mockPromptBuilder)
    vi.mocked(getContextAsString).mockResolvedValue('ctx')
    vi.mocked(generateContent).mockResolvedValue({
      content: 'ok', model: 'claude-sonnet-4-6',
      inputTokens: 10, outputTokens: 10, costUsd: 0.001,
    })
    vi.mocked(saveOutput).mockResolvedValue({ id: 'x' } as never)

    const ip = '99.99.99.99'
    // Exhaust the 10-request limit
    for (let i = 0; i < 10; i++) {
      await POST(makePostRequest({ prompt: 'test' }, ip))
    }

    const res = await POST(makePostRequest({ prompt: 'test' }, ip))
    expect(res.status).toBe(429)
  })

  it('returns 500 when generation fails', async () => {
    vi.mocked(getContextAsString).mockResolvedValue('ctx')
    vi.mocked(generateContent).mockRejectedValue(new Error('AI unavailable'))

    const { POST } = createAgentRoute('brand-identity', mockPromptBuilder)
    const res = await POST(makePostRequest({ prompt: 'test' }, '3.3.3.3'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('AI unavailable')
  })
})

describe('createAgentRoute — PATCH', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when outputId is missing', async () => {
    const { PATCH } = createAgentRoute('brand-identity', mockPromptBuilder)
    const res = await PATCH(makePatchRequest({}))
    expect(res.status).toBe(400)
  })

  it('approves an output and triggers background extraction', async () => {
    const fakeOutput = {
      id: 'out-1',
      agentTab: 'brand-identity',
      outputContent: 'some content',
      approved: true,
    }
    vi.mocked(prisma.agentOutput.update).mockResolvedValue(fakeOutput as never)

    const { PATCH } = createAgentRoute('brand-identity', mockPromptBuilder)
    const res = await PATCH(makePatchRequest({ outputId: 'out-1' }, '4.4.4.4'))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.approved).toBe(true)
    expect(data.learningInProgress).toBe(true)
  })
})
