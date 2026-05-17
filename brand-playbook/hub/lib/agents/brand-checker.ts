import { getBrandBibleSystemPrompt } from '../brand-bible'
import { generateWithFallback } from '../ai'
import type { BrandCheckResult } from './types'

export async function runBrandCheck(content: string, contentType: string): Promise<BrandCheckResult> {
  const systemPrompt = getBrandBibleSystemPrompt()

  const prompt = `Perform a strict brand audit on the following ${contentType} content for [Company].

Check against the Brand Bible you have been given. Return a JSON object with exactly this structure:
{
  "score": <number 0-100>,
  "passed": <boolean, true if score >= 70>,
  "issues": [
    {
      "type": "banned_word" | "wrong_tone" | "missing_proof" | "off_message" | "em_dash",
      "severity": "critical" | "warning",
      "text": "<the exact text that is the problem>",
      "suggestion": "<how to fix it>"
    }
  ],
  "suggestions": ["<overall improvement suggestion 1>", ...],
  "summary": "<2-3 sentence overall assessment>"
}

Scoring guide:
- Start at 100
- Deduct 15 for each em-dash
- Deduct 10 for each banned word (leverage, synergy, seamless, best-in-class, empower, journey, cutting-edge, robust, utilize, innovative)
- Deduct 20 for wrong brand name ("[Company]" instead of "[Company]")
- Deduct 15 for vague claims without proof points
- Deduct 10 for tone that is too corporate/formal
- Deduct 10 for content that sounds like generic AI output (no specific data, no opinion)
- Add 5 bonus if content includes a specific number or data point
- Add 5 bonus if content includes a genuine point of view

Return only valid JSON, no markdown fences.

Content to audit:
${content}`

  const raw = await generateWithFallback({
    system: systemPrompt,
    prompt,
    maxOutputTokens: 1024,
  })

  try {
    return JSON.parse(raw) as BrandCheckResult
  } catch {
    return {
      score: 50,
      passed: false,
      issues: [],
      suggestions: ['Could not parse brand check response. Review manually.'],
      summary: 'Brand check parsing failed. Please review manually.',
    }
  }
}
