import { NextResponse } from 'next/server'
import { getRecentInsights, getInsightCounts, getBrainTableCounts } from '@/lib/brain'

export async function GET() {
  try {
    const [insights, counts, tableCounts] = await Promise.all([
      getRecentInsights(8),
      getInsightCounts(),
      getBrainTableCounts(),
    ])
    return NextResponse.json({ insights, counts, tableCounts })
  } catch {
    return NextResponse.json(
      { insights: [], counts: {}, tableCounts: {} },
      { status: 200 }
    )
  }
}
