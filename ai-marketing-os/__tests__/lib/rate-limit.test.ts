import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows first request and returns correct remaining count', () => {
    const result = checkRateLimit('test-key-1', 5, 60_000)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.retryAfterMs).toBe(0)
  })

  it('allows requests up to the limit', () => {
    const key = 'test-key-2'
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key, 5, 60_000)
      expect(r.success).toBe(true)
    }
  })

  it('blocks the request exactly at the limit', () => {
    const key = 'test-key-3'
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000)

    const blocked = checkRateLimit(key, 5, 60_000)
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('resets after the window expires', () => {
    const key = 'test-key-4'
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000)

    // Advance past window
    vi.advanceTimersByTime(61_000)

    const result = checkRateLimit(key, 5, 60_000)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('tracks different keys independently', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('key-a', 5, 60_000)

    const blocked = checkRateLimit('key-a', 5, 60_000)
    expect(blocked.success).toBe(false)

    const other = checkRateLimit('key-b', 5, 60_000)
    expect(other.success).toBe(true)
  })
})

describe('getClientIp', () => {
  it('returns the first IP from x-forwarded-for', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-real-ip': '9.9.9.9' },
    })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('returns "unknown" when no IP headers are present', () => {
    const req = new Request('http://localhost/')
    expect(getClientIp(req)).toBe('unknown')
  })
})
