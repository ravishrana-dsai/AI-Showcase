import { NextRequest } from 'next/server'
import { runDirectorAgent } from '@/lib/agents/director'
import { streamWriterAgent } from '@/lib/agents/writer'
import { db, contentItems } from '@/lib/db'
import type { ContentBrief } from '@/lib/agents/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// Derives a short title from the first non-empty line of generated content.
function deriveTitle(content: string, brief: ContentBrief): string {
  const firstLine = content.split('\n').find((l) => l.trim().length > 0) ?? ''
  const cleaned = firstLine.replace(/^#+\s*/, '').trim()
  if (cleaned.length >= 8 && cleaned.length <= 120) return cleaned
  return `${brief.type.replace('_', ' ')} — ${brief.topic.substring(0, 60)}`
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { brief?: ContentBrief; freeform?: string; intelligenceItemId?: string }

  let brief: ContentBrief
  if (body.freeform) {
    brief = await runDirectorAgent({ freeformBrief: body.freeform })
  } else if (body.brief) {
    brief = body.brief
  } else {
    return Response.json({ error: 'Provide brief or freeform' }, { status: 400 })
  }

  const result = await streamWriterAgent(brief)

  // Accumulate the full streamed text, then save to DB.
  let fullContent = ''
  for await (const chunk of result.textStream) {
    fullContent += chunk
  }

  if (!fullContent.trim()) {
    return Response.json({ error: 'Writer produced no content' }, { status: 500 })
  }

  const title = deriveTitle(fullContent, brief)

  const [saved] = await db
    .insert(contentItems)
    .values({
      title,
      content: fullContent,
      contentType: brief.type,
      status: 'pending_review',
      brief: brief.topic,
      targetAudience: brief.targetAudience,
    })
    .returning()

  return Response.json({ id: saved.id, title: saved.title }, { status: 201 })
}
