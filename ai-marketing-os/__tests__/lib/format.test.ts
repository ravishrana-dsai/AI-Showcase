import { describe, it, expect } from 'vitest'
import { formatCost } from '@/lib/format'

describe('formatCost', () => {
  it('formats sub-cent amounts as cents', () => {
    expect(formatCost(0.001)).toBe('$0.100¢')
    expect(formatCost(0.0001)).toBe('$0.010¢')
    expect(formatCost(0.009)).toBe('$0.900¢')
  })

  it('formats amounts >= $0.01 with four decimal places', () => {
    expect(formatCost(0.01)).toBe('$0.0100')
    expect(formatCost(0.1234)).toBe('$0.1234')
    expect(formatCost(1.5)).toBe('$1.5000')
    expect(formatCost(10)).toBe('$10.0000')
  })

  it('handles zero', () => {
    expect(formatCost(0)).toBe('$0.000¢')
  })

  it('boundary: exactly $0.01 uses dollar format', () => {
    expect(formatCost(0.01)).toMatch(/^\$/)
    expect(formatCost(0.01)).not.toContain('¢')
  })
})
