import { getBrandBibleSystemPrompt } from '../brand-bible'
import { generateWithFallback } from '../ai'
import type { SeoResult } from './types'

export async function runSeoAgent(content: string, contentType: string): Promise<SeoResult> {
  const systemPrompt = getBrandBibleSystemPrompt()

  const prompt = `You are an SEO specialist for [Company], a padel and pickleball player intelligence platform.

Analyse the following ${contentType} and return SEO recommendations as JSON:
{
  "primaryKeyword": "<single most important search term this content targets>",
  "secondaryKeywords": ["<keyword 2>", "<keyword 3>", "<keyword 4>"],
  "metaDescription": "<compelling meta description under 155 characters, includes primary keyword>",
  "headlineSuggestions": ["<alt headline 1>", "<alt headline 2>", "<alt headline 3>"],
  "score": <number 0-100 SEO quality score>
}

Focus on padel and pickleball audiences. Target keywords players actually search for:
- padel skill rating, padel player level, how to improve padel, padel analytics
- pickleball skill assessment, pickleball improvement, pickleball player rating
- [Company] Rating, Player Rating padel, padel AI

Return only valid JSON, no markdown fences.

Content:
${content}`

  const raw = await generateWithFallback({
    system: systemPrompt,
    prompt,
    maxOutputTokens: 512,
  })

  try {
    return JSON.parse(raw) as SeoResult
  } catch {
    return {
      primaryKeyword: 'padel player intelligence',
      secondaryKeywords: ['Player Rating', 'padel skill rating', 'pickleball analytics'],
      metaDescription: content.substring(0, 150),
      headlineSuggestions: [],
      score: 50,
    }
  }
}
