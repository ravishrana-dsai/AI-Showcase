import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { calculateCost, logCost } from './cost-tracker'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const genai = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '')

export type GenerateResult = {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export async function extractWithHaiku(
  systemPrompt: string,
  content: string
): Promise<GenerateResult> {
  // Try Haiku first, fall back to Gemini Flash if Anthropic key is missing or fails
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
      })
      const inputTokens  = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const costUsd      = calculateCost('claude-haiku-4-5', inputTokens, outputTokens)
      await logCost('brain-extraction', 'claude-haiku-4-5', inputTokens, outputTokens, costUsd)
      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      return { content: text, model: 'claude-haiku-4-5', inputTokens, outputTokens, costUsd }
    } catch (err) {
      console.error('[brain] Haiku extraction failed, falling back to Gemini:', err)
    }
  }

  // Gemini fallback for extraction
  const geminiModel = genai.getGenerativeModel({ model: 'gemini-2.5-pro' })
  const result = await geminiModel.generateContent(`${systemPrompt}\n\n---\n\n${content}`)
  const inputTokens  = result.response.usageMetadata?.promptTokenCount ?? 0
  const outputTokens = result.response.usageMetadata?.candidatesTokenCount ?? 0
  const costUsd      = calculateCost('gemini-2.5-pro', inputTokens, outputTokens)
  await logCost('brain-extraction', 'gemini-2.5-pro', inputTokens, outputTokens, costUsd)
  return {
    content: result.response.text(),
    model: 'gemini-2.5-pro',
    inputTokens,
    outputTokens,
    costUsd,
  }
}

export async function generateContent(
  agentTab: string,
  systemPrompt: string,
  userPrompt: string
): Promise<GenerateResult> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const costUsd = calculateCost('claude-sonnet-4-6', inputTokens, outputTokens)
    await logCost(agentTab, 'claude-sonnet-4-6', inputTokens, outputTokens, costUsd)

    const content =
      response.content[0].type === 'text' ? response.content[0].text : ''

    return { content, model: 'claude-sonnet-4-6', inputTokens, outputTokens, costUsd }
  } catch (primaryError) {
    console.error('Claude API error, falling back to Gemini:', primaryError)

    const model = genai.getGenerativeModel({ model: 'gemini-2.5-pro' })
    const result = await model.generateContent(
      `${systemPrompt}\n\n---\n\n${userPrompt}`
    )

    const inputTokens = result.response.usageMetadata?.promptTokenCount ?? 0
    const outputTokens = result.response.usageMetadata?.candidatesTokenCount ?? 0
    const costUsd = calculateCost('gemini-2.5-pro', inputTokens, outputTokens)
    await logCost(agentTab, 'gemini-2.5-pro', inputTokens, outputTokens, costUsd)

    return {
      content: result.response.text(),
      model: 'gemini-2.5-pro',
      inputTokens,
      outputTokens,
      costUsd,
    }
  }
}
