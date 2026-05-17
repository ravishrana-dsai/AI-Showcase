import { extractWithHaiku } from './ai'
import { prisma } from './db'

type RawInsight = {
  insightType: string
  category: string
  summary: string
  detail: string
}

const VALID_TYPES = new Set([
  'brand_voice',
  'audience_segment',
  'content_performance',
  'competitive_intel',
  'general_learning',
])

const VALID_CATEGORIES = new Set(['brand', 'product', 'audience', 'competitive'])

const EXTRACTION_SYSTEM_PROMPT = `You are a marketing intelligence extractor. Your job is to read approved marketing content and extract reusable insights that can improve future content generation.

Analyse the content and return a JSON array of insights. Each insight must follow this exact structure:
{
  "insightType": "<one of: brand_voice | audience_segment | content_performance | competitive_intel | general_learning>",
  "category": "<one of: brand | product | audience | competitive>",
  "summary": "<one sentence, max 200 chars, capturing the core insight>",
  "detail": "<2-3 sentences expanding on the insight with specifics>"
}

Rules:
- Return an empty array [] if you cannot find any novel, reusable insight
- Do not repeat obvious facts already stated in the brand brief
- Focus on patterns, preferences, angles, or framings that worked well in this content
- Limit to a maximum of 3 insights per output
- Return ONLY the JSON array, no markdown, no explanation

Example output:
[
  {
    "insightType": "brand_voice",
    "category": "brand",
    "summary": "Short punchy sentences with a data anchor land better than long paragraphs for Player Rating positioning.",
    "detail": "The approved content used sentence structures like 'X matches. Y players. Z insight.' which creates rhythm and credibility. Avoid sentences longer than 20 words when writing about Player Rating mechanics."
  }
]`

function parseInsights(raw: string): RawInsight[] {
  const trimmed = raw.trim()
  const jsonStr = trimmed.startsWith('[')
    ? trimmed
    : trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

  const parsed = JSON.parse(jsonStr)
  if (!Array.isArray(parsed)) return []

  return parsed.filter(
    (item): item is RawInsight =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.insightType === 'string' &&
      typeof item.category === 'string' &&
      typeof item.summary === 'string' &&
      typeof item.detail === 'string' &&
      VALID_TYPES.has(item.insightType) &&
      VALID_CATEGORIES.has(item.category)
  )
}

async function routeInsight(
  insight: RawInsight,
  insightId: string
): Promise<string | null> {
  try {
    if (insight.insightType === 'brand_voice') {
      const existing = await prisma.brandBible.findFirst({
        orderBy: { updatedAt: 'desc' },
      })
      if (existing) {
        await prisma.brandBible.update({
          where: { id: existing.id },
          data: {
            voicePrinciples: {
              push: insight.summary.slice(0, 200),
            },
          },
        })
      } else {
        await prisma.brandBible.create({
          data: {
            voicePrinciples: [insight.summary.slice(0, 200)],
            taglines: [],
            brandPositioning: {},
          },
        })
      }
      return 'brand_bibles'
    }

    if (insight.insightType === 'audience_segment') {
      const existing = await prisma.audienceIntel.findFirst({
        where: { segmentName: insight.category },
      })
      if (existing) {
        const currentInsights = existing.insights as string[]
        await prisma.audienceIntel.update({
          where: { id: existing.id },
          data: {
            insights: [...currentInsights, insight.summary].slice(-20),
          },
        })
      } else {
        await prisma.audienceIntel.create({
          data: {
            segmentName: insight.category,
            insights: [insight.summary],
            trendingTopics: [],
          },
        })
      }
      return 'audience_intel'
    }

    if (insight.insightType === 'content_performance') {
      await prisma.performanceHistory.create({
        data: {
          agentTab: 'brain-extraction',
          contentType: insight.category,
          platform: 'general',
          outputPreview: insight.summary.slice(0, 500),
        },
      })
      return 'performance_history'
    }

    return null
  } catch (err) {
    console.error(`[brain] routing failed for insight ${insightId}:`, err)
    return null
  }
}

export async function extractInsights(
  outputId: string,
  agentTab: string,
  outputContent: string
): Promise<void> {
  try {
    const result = await extractWithHaiku(
      EXTRACTION_SYSTEM_PROMPT,
      `Agent tab: ${agentTab}\n\nApproved content:\n${outputContent.slice(0, 3000)}`
    )

    let insights: RawInsight[] = []
    try {
      insights = parseInsights(result.content)
    } catch {
      insights = [
        {
          insightType: 'general_learning',
          category: 'brand',
          summary: `Learning from ${agentTab} output (parse failed, see detail)`,
          detail: result.content.slice(0, 500),
        },
      ]
    }

    if (insights.length === 0) {
      await prisma.agentOutput.update({
        where: { id: outputId },
        data: { extractionStatus: 'skipped' },
      })
      return
    }

    for (const insight of insights) {
      const created = await prisma.brainInsight.create({
        data: {
          sourceOutputId: outputId,
          sourceAgentTab: agentTab,
          insightType: insight.insightType,
          category: insight.category,
          summary: insight.summary.slice(0, 200),
          detail: insight.detail.slice(0, 1000),
        },
      })
      const routedTo = await routeInsight(insight, created.id)
      if (routedTo) {
        await prisma.brainInsight.update({
          where: { id: created.id },
          data: { routedTo },
        })
      }
    }

    await prisma.agentOutput.update({
      where: { id: outputId },
      data: { extractionStatus: 'completed' },
    })
  } catch (err) {
    console.error('[brain] extractInsights failed:', err)
    await prisma.agentOutput.update({
      where: { id: outputId },
      data: { extractionStatus: 'failed' },
    }).catch(() => null)
  }
}
