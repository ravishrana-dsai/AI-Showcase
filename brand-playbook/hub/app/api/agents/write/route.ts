import { NextRequest } from 'next/server'
import { streamWriterAgent } from '@/lib/agents/writer'
import { runDirectorAgent } from '@/lib/agents/director'
import type { ContentBrief } from '@/lib/agents/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const body = await req.json() as { brief?: ContentBrief; freeform?: string }

  let brief: ContentBrief
  if (body.freeform) {
    brief = await runDirectorAgent({ freeformBrief: body.freeform })
  } else if (body.brief) {
    brief = body.brief
  } else {
    return Response.json({ error: 'Provide brief or freeform' }, { status: 400 })
  }

  const result = await streamWriterAgent(brief)
  return result.toTextStreamResponse()
}
