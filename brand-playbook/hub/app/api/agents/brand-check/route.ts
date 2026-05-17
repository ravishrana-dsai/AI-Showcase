import { NextRequest } from 'next/server'
import { runBrandCheck } from '@/lib/agents/brand-checker'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const { content, contentType } = await req.json() as { content: string; contentType: string }

  if (!content || !contentType) {
    return Response.json({ error: 'content and contentType required' }, { status: 400 })
  }

  const result = await runBrandCheck(content, contentType)
  return Response.json(result)
}
