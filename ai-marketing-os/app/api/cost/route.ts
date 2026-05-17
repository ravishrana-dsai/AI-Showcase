import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const [logs, totalCost, byTab, byModel] = await Promise.all([
      prisma.apiCostLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.apiCostLog.aggregate({ _sum: { costUsd: true } }),
      prisma.apiCostLog.groupBy({
        by: ['agentTab'],
        _sum: { costUsd: true },
        _count: { id: true },
        orderBy: { _sum: { costUsd: 'desc' } },
      }),
      prisma.apiCostLog.groupBy({
        by: ['model'],
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
    ])

    return NextResponse.json({
      logs,
      totalCost: totalCost._sum.costUsd ?? 0,
      byTab,
      byModel,
    })
  } catch {
    return NextResponse.json(
      { logs: [], totalCost: 0, byTab: [], byModel: [] },
      { status: 200 }
    )
  }
}
