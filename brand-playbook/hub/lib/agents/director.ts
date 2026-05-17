import { getBrandBibleSystemPrompt } from '../brand-bible'
import { generateWithFallback } from '../ai'
import type { ContentBrief, ContentType, TargetAudience } from './types'

interface DirectorInput {
  freeformBrief: string
}

interface DirectorOutput {
  type: ContentType
  topic: string
  targetAudience: TargetAudience
  keyPoints: string[]
  tone: string
  suggestedTitle: string
  reasoning: string
}

export async function runDirectorAgent(input: DirectorInput): Promise<ContentBrief> {
  const systemPrompt = getBrandBibleSystemPrompt()

  const prompt = `You are the [Company] Content Director. A team member has submitted this brief:

"${input.freeformBrief}"

Parse this into a structured content brief. Return JSON:
{
  "type": "blog" | "linkedin_post" | "linkedin_article" | "reddit_post" | "reddit_comment" | "newsletter" | "press_release",
  "topic": "<clear single-sentence topic statement>",
  "targetAudience": "competitive_player" | "casual_player" | "tournament_player" | "court_operator" | "investor" | "general",
  "keyPoints": ["<point 1>", "<point 2>", "<point 3>"],
  "tone": "<tone guidance specific to this piece>",
  "suggestedTitle": "<strong working title>",
  "reasoning": "<1-2 sentences explaining your choices>"
}

Available content types:
- blog: Long-form article for [Company] blog or Medium
- linkedin_post: Short LinkedIn status update (250 words)
- linkedin_article: Long-form LinkedIn article (800 words)
- reddit_post: Original post in a relevant subreddit
- reddit_comment: Reply to an existing thread
- newsletter: Section for email newsletter
- press_release: Formal press release

Use the Brand Bible to make choices that serve [Company]'s positioning as the #1 player intelligence platform in padel.

Return only valid JSON, no markdown fences.`

  const raw = await generateWithFallback({ system: systemPrompt, prompt, maxOutputTokens: 512 })

  try {
    const parsed = JSON.parse(raw) as DirectorOutput
    return {
      type: parsed.type,
      topic: parsed.topic,
      targetAudience: parsed.targetAudience,
      keyPoints: parsed.keyPoints,
      tone: parsed.tone,
    }
  } catch {
    return {
      type: 'linkedin_post',
      topic: input.freeformBrief,
      targetAudience: 'general',
      keyPoints: [],
    }
  }
}
