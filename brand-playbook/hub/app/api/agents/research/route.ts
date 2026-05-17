import { NextRequest } from 'next/server'
import { runDirectorAgent } from '@/lib/agents/director'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const { freeformBrief } = await req.json() as { freeformBrief: string }

  if (!freeformBrief) {
    return Response.json({ error: 'freeformBrief required' }, { status: 400 })
  }

  const brief = await runDirectorAgent({ freeformBrief })
  return Response.json(brief)
}
