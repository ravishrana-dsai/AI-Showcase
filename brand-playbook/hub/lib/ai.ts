import Anthropic from '@anthropic-ai/sdk'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, generateText, type LanguageModel } from 'ai'

export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const anthropicProvider = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
})

export function getPrimaryModel(): LanguageModel {
  return anthropicProvider('claude-sonnet-4-6')
}

export function getFallbackModel(): LanguageModel {
  return googleProvider('gemini-2.0-flash')
}

export async function streamWithFallback(params: {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxOutputTokens?: number
}) {
  try {
    return streamText({
      model: getPrimaryModel(),
      system: params.system,
      messages: params.messages,
      maxOutputTokens: params.maxOutputTokens ?? 4096,
    })
  } catch (err) {
    console.warn('Anthropic failed, falling back to Gemini:', err)
    return streamText({
      model: getFallbackModel(),
      system: params.system,
      messages: params.messages,
      maxOutputTokens: params.maxOutputTokens ?? 4096,
    })
  }
}

export async function generateWithFallback(params: {
  system: string
  prompt: string
  maxOutputTokens?: number
}): Promise<string> {
  try {
    const result = await generateText({
      model: getPrimaryModel(),
      system: params.system,
      prompt: params.prompt,
      maxOutputTokens: params.maxOutputTokens ?? 2048,
    })
    return result.text
  } catch (err) {
    console.warn('Anthropic failed, falling back to Gemini:', err)
    const result = await generateText({
      model: getFallbackModel(),
      system: params.system,
      prompt: params.prompt,
      maxOutputTokens: params.maxOutputTokens ?? 2048,
    })
    return result.text
  }
}
