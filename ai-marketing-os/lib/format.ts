/** Pure formatting utilities — safe to import in client components */

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`
  return `$${usd.toFixed(4)}`
}
