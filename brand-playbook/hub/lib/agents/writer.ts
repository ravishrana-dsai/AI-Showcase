import { getBrandBibleSystemPrompt } from '../brand-bible'
import { streamWithFallback } from '../ai'
import type { ContentBrief, ContentType } from './types'

const WORD_COUNTS: Record<ContentType, number> = {
  blog: 1200,
  linkedin_article: 800,
  linkedin_post: 250,
  reddit_post: 400,
  reddit_comment: 200,
  newsletter: 600,
  press_release: 500,
}

const FORMAT_INSTRUCTIONS: Record<ContentType, string> = {
  blog: `Write a complete blog post with:
- A headline that a reasonable person could disagree with (no generic titles)
- An opening that names the problem specifically, no throat-clearing
- 3-5 sections with subheadings
- Specific data points from the brand bible where relevant
- A closing that ends with clarity, not a vague call-to-action
- Format in clean Markdown`,

  linkedin_post: `Write a LinkedIn post with:
- An opening line that is bold, specific, or surprising. No "Excited to share..." openers.
- Short punchy paragraphs (1-2 sentences)
- At least one specific number or data point
- A clear point of view the reader can agree or disagree with
- End with a question or a declarative close, not a CTA
- No hashtag stuffing (max 3 relevant hashtags)
- Format in plain text`,

  linkedin_article: `Write a LinkedIn article with:
- A bold, specific headline
- Hook in the first sentence
- 4-6 sections with H2 subheadings
- Data points, proof, and specific examples throughout
- Conversational but expert tone
- Format in Markdown`,

  reddit_post: `Write a Reddit post that:
- Leads with genuine value or a real question, not promotion
- Sounds like a knowledgeable community member, not a brand
- Includes the brand context naturally, never as the headline
- Is conversational and direct
- Format in plain text with minimal Markdown`,

  reddit_comment: `Write a Reddit comment that:
- Directly addresses the thread topic with genuine insight
- Adds specific value (data, experience, explanation)
- Mentions [Company] only if directly relevant, naturally
- Sounds like a person, not a brand
- Is 2-4 short paragraphs
- Format in plain text`,

  newsletter: `Write a newsletter section with:
- A punchy subject line suggestion
- Warm but expert opening
- The key insight or story clearly stated
- Supporting data or example
- A clear takeaway for the reader
- Format in Markdown`,

  press_release: `Write a press release with:
- Headline in AP style
- Dateline and opening paragraph with the 5 Ws
- 2-3 body paragraphs with supporting detail
- One executive quote (attribute to Amit Sharma, CEO)
- Boilerplate about [Company]
- Contact section placeholder
- Format in plain text`,
}

const AUDIENCE_CONTEXT: Record<string, string> = {
  competitive_player: 'The reader plays 2-4 times per week, wants an objective skill number, and is frustrated by vague self-assessments. Speak to their competitive instinct and desire for precision.',
  casual_player: 'The reader plays once or twice a week for fun but is catching the improvement bug. Keep it simple, encouraging, and accessible. No jargon without explanation.',
  tournament_player: 'The reader trains regularly, works with a coach, and wants data to complement their training. They understand technical terminology.',
  court_operator: 'The reader runs a padel club and cares about player retention, tournament quality, and revenue. Speak to business outcomes.',
  investor: 'The reader evaluates startups. Lead with market size, traction, and moat. Every claim needs a number. Be bold about the opportunity.',
  general: 'Write for an intelligent reader who is new to the product but understands sports.',
}

export async function streamWriterAgent(brief: ContentBrief) {
  const systemPrompt = getBrandBibleSystemPrompt()
  const wordCount = brief.wordCount ?? WORD_COUNTS[brief.type]
  const formatInstructions = FORMAT_INSTRUCTIONS[brief.type]
  const audienceContext = AUDIENCE_CONTEXT[brief.targetAudience] ?? AUDIENCE_CONTEXT.general

  const userPrompt = `Write the following content for [Company].

Content type: ${brief.type.replace('_', ' ')}
Topic: ${brief.topic}
Target word count: ~${wordCount} words
${brief.keyPoints?.length ? `Key points to include:\n${brief.keyPoints.map(p => `- ${p}`).join('\n')}` : ''}
${brief.inspirationContext ? `Context/inspiration: ${brief.inspirationContext}` : ''}

Audience context: ${audienceContext}

Format instructions:
${formatInstructions}

Apply the [Company] brand voice throughout. The content must pass the "Un-AI test": include at least one specific data point, one point of view someone could disagree with, and language that sounds like a real expert in the sport.`

  return streamWithFallback({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxOutputTokens: Math.max(wordCount * 2, 2048),
  })
}
