import { prisma } from './db'

const LEARNINGS_CHAR_CAP = 2000

export async function getContext(): Promise<Record<string, string>> {
  const inputs = await prisma.contextInput.findMany({
    orderBy: { category: 'asc' },
  })
  return Object.fromEntries(inputs.map((i: { key: string; value: string }) => [i.key, i.value]))
}

export async function getContextAsString(): Promise<string> {
  const context = await getContext()
  const baseContext = Object.entries(context)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')

  const learningsSection = await buildLearningsSection()
  if (!learningsSection) return baseContext

  return `${baseContext}\n\n${learningsSection}`
}

async function buildLearningsSection(): Promise<string> {
  const parts: string[] = []

  // Brand voice learnings
  const brandBible = await prisma.brandBible.findFirst({
    orderBy: { updatedAt: 'desc' },
  })
  if (brandBible && brandBible.voicePrinciples.length > 0) {
    const principles = brandBible.voicePrinciples.slice(-5).join(' | ')
    parts.push(`brand_voice_learnings: ${principles}`)
  }

  // Audience insights
  const audienceIntel = await prisma.audienceIntel.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
  })
  if (audienceIntel.length > 0) {
    const lines = audienceIntel.map((a: { segmentName: string; insights: unknown }) => {
      const insights = a.insights as string[]
      return `${a.segmentName}: ${insights.slice(-2).join('; ')}`
    })
    parts.push(`audience_insights: ${lines.join(' | ')}`)
  }

  // Recent brain insights (summaries only)
  const recentInsights = await prisma.brainInsight.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { insightType: true, summary: true },
  })
  if (recentInsights.length > 0) {
    const lines = recentInsights.map((i: { insightType: string; summary: string }) => `[${i.insightType}] ${i.summary}`)
    parts.push(`recent_learnings: ${lines.join(' | ')}`)
  }

  if (parts.length === 0) return ''

  const section =
    '--- LEARNED CONTEXT (background knowledge from approved outputs, not direct content) ---\n' +
    parts.join('\n')

  // Hard cap to avoid prompt bloat
  return section.length > LEARNINGS_CHAR_CAP
    ? section.slice(0, LEARNINGS_CHAR_CAP) + '...'
    : section
}

export async function getRecentInsights(limit = 10) {
  return prisma.brainInsight.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      sourceAgentTab: true,
      insightType: true,
      category: true,
      summary: true,
      detail: true,
      routedTo: true,
      createdAt: true,
    },
  })
}

export async function getInsightCounts() {
  const rows = await prisma.brainInsight.groupBy({
    by: ['insightType'],
    _count: { id: true },
  })
  const counts: Record<string, number> = {
    brand_voice: 0,
    audience_segment: 0,
    content_performance: 0,
    competitive_intel: 0,
    general_learning: 0,
  }
  for (const row of rows) {
    counts[row.insightType] = row._count.id
  }
  counts.total = rows.reduce((sum: number, r: { _count: { id: number } }) => sum + r._count.id, 0)
  return counts
}

export async function getBrainTableCounts() {
  const [brandBibles, audienceIntel, perfHistory, relMemory] = await Promise.all([
    prisma.brandBible.count(),
    prisma.audienceIntel.count(),
    prisma.performanceHistory.count(),
    prisma.relationshipMemory.count(),
  ])
  return { brandBibles, audienceIntel, perfHistory, relMemory }
}

export async function getBrandBible() {
  return prisma.brandBible.findFirst({ orderBy: { updatedAt: 'desc' } })
}

export async function getRecentOutputs(agentTab: string, limit = 5) {
  return prisma.agentOutput.findMany({
    where: { agentTab },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

export async function getRecentBrainActivity(limit = 8) {
  return prisma.apiCostLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      agentTab: true,
      model: true,
      costUsd: true,
      createdAt: true,
      inputTokens: true,
      outputTokens: true,
    },
  })
}

export async function saveOutput(data: {
  agentTab: string
  inputPrompt: string
  outputContent: string
  modelUsed: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}) {
  return prisma.agentOutput.create({ data })
}
