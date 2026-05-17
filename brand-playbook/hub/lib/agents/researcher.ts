import { getBrandBibleSystemPrompt } from '../brand-bible'
import { generateWithFallback } from '../ai'
import type { ResearchResult } from './types'

interface ResearchInput {
  title: string
  url: string
  body: string
  source: string
}

export async function scoreAndSummariseItem(item: ResearchInput): Promise<{
  relevanceScore: number
  summary: string
  suggestedAngle: string
}> {
  const systemPrompt = getBrandBibleSystemPrompt()

  const prompt = `You are the [Company] Research Agent. Evaluate this ${item.source} post/article for [Company]'s content team.

Title: ${item.title}
URL: ${item.url}
Content: ${item.body.substring(0, 1500)}

Return JSON:
{
  "relevanceScore": <0-100, how relevant is this for [Company]'s brand building?>,
  "summary": "<2-3 sentence neutral summary of the content>",
  "suggestedAngle": "<specific [Company] content angle this could inspire, or empty string if not relevant>"
}

Relevance scoring:
- 80-100: Directly about padel/pickleball skill, ratings, or AI sports analytics. High opportunity.
- 60-79: About racket sports improvement, performance tracking, or sports tech broadly.
- 40-59: Adjacent topic (general sports AI, fitness tracking, data-driven sport).
- 0-39: Low relevance. Not worth actioning.

Return only valid JSON, no markdown fences.`

  const raw = await generateWithFallback({ system: systemPrompt, prompt, maxOutputTokens: 300 })

  try {
    return JSON.parse(raw)
  } catch {
    return { relevanceScore: 0, summary: item.title, suggestedAngle: '' }
  }
}

export async function generateResponseContent(item: ResearchInput, responseType: 'reddit_comment' | 'linkedin_post' | 'blog'): Promise<string> {
  const systemPrompt = getBrandBibleSystemPrompt()

  const prompt = `Write a [Company] ${responseType.replace('_', ' ')} inspired by or responding to this content.

Original content:
Title: ${item.title}
URL: ${item.url}
Body: ${item.body.substring(0, 800)}

The response should:
- Add genuine value, not just reference [Company]
- Apply the [Company] brand voice (expert friend, specific, data-backed)
- Mention [Company] and Player Rating naturally if relevant, never forcefully
- Be the word count appropriate for ${responseType}

Write the content only, no additional commentary.`

  return generateWithFallback({ system: systemPrompt, prompt, maxOutputTokens: 1024 })
}
