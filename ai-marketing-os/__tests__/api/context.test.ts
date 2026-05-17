import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    contextInput: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ success: true, remaining: 19, retryAfterMs: 0 }),
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}))

import { GET, POST } from '@/app/api/context/route'
import { prisma } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'

function makePostRequest(body: unknown) {
  return new Request('http://localhost/api/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/context', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all context inputs sorted', async () => {
    const inputs = [{ id: '1', key: 'brand_name', value: '[Company]' }]
    vi.mocked(prisma.contextInput.findMany).mockResolvedValue(inputs as never)

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(inputs)
  })

  it('returns 500 on DB error', async () => {
    vi.mocked(prisma.contextInput.findMany).mockRejectedValue(new Error('DB down'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/context', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts all provided updates', async () => {
    vi.mocked(prisma.contextInput.upsert).mockResolvedValue({} as never)

    const updates = [
      { key: 'brand_name', value: '[Company]', label: 'Brand Name', category: 'brand' },
      { key: 'tagline', value: 'Play Smart', label: 'Tagline', category: 'brand' },
    ]
    const res = await POST(makePostRequest({ updates }))
    expect(res.status).toBe(200)
    expect((await res.json()).updated).toBe(2)
    expect(prisma.contextInput.upsert).toHaveBeenCalledTimes(2)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValueOnce({ success: false, remaining: 0, retryAfterMs: 3000 })
    const res = await POST(makePostRequest({ updates: [] }))
    expect(res.status).toBe(429)
  })

  it('returns 500 on DB error', async () => {
    vi.mocked(prisma.contextInput.upsert).mockRejectedValue(new Error('DB down'))
    const res = await POST(makePostRequest({ updates: [{ key: 'x', value: 'y', label: 'L', category: 'brand' }] }))
    expect(res.status).toBe(500)
  })
})
