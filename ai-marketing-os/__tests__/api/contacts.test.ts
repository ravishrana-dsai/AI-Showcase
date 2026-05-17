import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    relationshipMemory: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ success: true, remaining: 29, retryAfterMs: 0 }),
  getClientIp: vi.fn().mockReturnValue('1.2.3.4'),
}))

import { GET, POST, PATCH, DELETE } from '@/app/api/contacts/route'
import { prisma } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'

function makeRequest(method: string, body?: unknown) {
  return new Request('http://localhost/api/contacts', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all contacts', async () => {
    const contacts = [{ id: '1', contactName: 'Alice' }]
    vi.mocked(prisma.relationshipMemory.findMany).mockResolvedValue(contacts as never)

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(contacts)
  })

  it('returns empty array on DB error', async () => {
    vi.mocked(prisma.relationshipMemory.findMany).mockRejectedValue(new Error('DB down'))
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('POST /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a contact with defaults', async () => {
    const created = { id: '2', contactName: 'Bob', contactType: 'influencer' }
    vi.mocked(prisma.relationshipMemory.create).mockResolvedValue(created as never)

    const res = await POST(makeRequest('POST', { contactName: 'Bob' }))
    expect(res.status).toBe(200)
    expect(prisma.relationshipMemory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactType: 'influencer' }) })
    )
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValueOnce({ success: false, remaining: 0, retryAfterMs: 5000 })
    const res = await POST(makeRequest('POST', { contactName: 'Bob' }))
    expect(res.status).toBe(429)
  })
})

describe('PATCH /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when id is missing', async () => {
    const res = await PATCH(makeRequest('PATCH', { notes: 'hello' }))
    expect(res.status).toBe(400)
  })

  it('updates a contact', async () => {
    const updated = { id: '1', notes: 'updated' }
    vi.mocked(prisma.relationshipMemory.update).mockResolvedValue(updated as never)

    const res = await PATCH(makeRequest('PATCH', { id: '1', notes: 'updated' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(updated)
  })
})

describe('DELETE /api/contacts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when id is missing', async () => {
    const res = await DELETE(makeRequest('DELETE', {}))
    expect(res.status).toBe(400)
  })

  it('deletes a contact', async () => {
    vi.mocked(prisma.relationshipMemory.delete).mockResolvedValue({} as never)
    const res = await DELETE(makeRequest('DELETE', { id: '1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).deleted).toBe(true)
  })
})
