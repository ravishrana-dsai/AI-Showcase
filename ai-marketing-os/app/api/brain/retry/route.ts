import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { extractInsights } from '@/lib/insight-extractor'

// POST /api/brain/retry — re-runs extraction on all approved outputs
// that have extractionStatus = 'failed' or 'pending'
export async function POST() {
  try {
    const pending = await prisma.agentOutput.findMany({
      where: {
        approved: true,
        extractionStatus: { in: ['failed', 'pending'] },
      },
      select: { id: true, agentTab: true, outputContent: true },
    })

    if (pending.length === 0) {
      return NextResponse.json({ retried: 0, message: 'Nothing to retry' })
    }

    // Fire all in parallel (fire-and-forget)
    for (const output of pending) {
      extractInsights(output.id, output.agentTab, output.outputContent).catch(
        (err) => console.error(`[brain] retry failed for ${output.id}:`, err)
      )
    }

    return NextResponse.json({ retried: pending.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Retry failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
