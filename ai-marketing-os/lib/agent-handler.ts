import { NextResponse } from 'next/server'
import { generateContent } from './ai'
import { getContextAsString, saveOutput } from './brain'
import { extractInsights } from './insight-extractor'
import { prisma } from './db'
import { checkRateLimit, getClientIp } from './rate-limit'

type PromptBuilder = (context: string) => string

// 10 AI generations per minute per IP
const AI_LIMIT = 10
const AI_WINDOW_MS = 60_000

// 30 approval/read requests per minute per IP
const APPROVE_LIMIT = 30
const APPROVE_WINDOW_MS = 60_000

export function createAgentRoute(agentTab: string, buildSystemPrompt: PromptBuilder) {
  async function GET(req: Request) {
    try {
      const { searchParams } = new URL(req.url)
      const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

      const outputs = await prisma.agentOutput.findMany({
        where: { agentTab },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return NextResponse.json(outputs)
    } catch {
      return NextResponse.json([], { status: 200 })
    }
  }

  async function POST(req: Request) {
    const ip = getClientIp(req)
    const rl = checkRateLimit(`${ip}:ai:${agentTab}`, AI_LIMIT, AI_WINDOW_MS)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before generating again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
        }
      )
    }

    try {
      const { prompt } = await req.json()
      if (!prompt?.trim()) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
      }

      const context = await getContextAsString()
      const systemPrompt = buildSystemPrompt(context)

      const result = await generateContent(agentTab, systemPrompt, prompt)

      const saved = await saveOutput({
        agentTab,
        inputPrompt: prompt,
        outputContent: result.content,
        modelUsed: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      })

      return NextResponse.json({ ...result, outputId: saved.id })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  async function PATCH(req: Request) {
    const ip = getClientIp(req)
    const rl = checkRateLimit(`${ip}:approve:${agentTab}`, APPROVE_LIMIT, APPROVE_WINDOW_MS)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      )
    }

    try {
      const { outputId } = await req.json()
      if (!outputId) {
        return NextResponse.json({ error: 'outputId required' }, { status: 400 })
      }

      const output = await prisma.agentOutput.update({
        where: { id: outputId },
        data: { approved: true },
      })

      // Fire-and-forget: extract insights without blocking the response
      extractInsights(output.id, output.agentTab, output.outputContent).catch(
        (err) => console.error('[brain] background extraction error:', err)
      )

      return NextResponse.json({ approved: true, learningInProgress: true })
    } catch {
      return NextResponse.json({ error: 'Approval failed' }, { status: 500 })
    }
  }

  return { GET, POST, PATCH }
}
