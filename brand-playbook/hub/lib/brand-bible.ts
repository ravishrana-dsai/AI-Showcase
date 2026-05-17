import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const FILES = [
  '01-foundation.md',
  '02-positioning.md',
  '03-voice-tone.md',
  '04-messaging.md',
  '05-visual-identity.md',
  '06-content-strategy.md',
  '07-brand-in-action.md',
]

let cached: string | null = null

export function loadBrandBible(): string {
  if (cached) return cached

  const brandBibleDir = process.env.BRAND_BIBLE_PATH ?? join(process.cwd(), '..')

  const sections = FILES.map((file) => {
    const filePath = join(brandBibleDir, file)
    if (!existsSync(filePath)) {
      console.warn(`Brand bible file not found: ${filePath}`)
      return ''
    }
    return readFileSync(filePath, 'utf-8')
  }).filter(Boolean)

  cached = sections.join('\n\n---\n\n')
  return cached
}

export function getBrandBibleSystemPrompt(): string {
  const bible = loadBrandBible()
  return `You are the [Company] Brand Intelligence Agent. [Company] is an AI-powered sports performance platform giving padel and pickleball players a scientific skill rating (Player Rating) from match footage.

Your entire brand context is below. Every piece of content you write must be consistent with this Brand Bible. Study it carefully and apply it faithfully.

<brand_bible>
${bible}
</brand_bible>

Key rules you must always follow:
- Never use em-dashes (—). Rewrite with colons, periods, or commas instead.
- Never use these words: leverage, synergy, seamless, best-in-class, empower, journey, cutting-edge, robust, utilize, innovative, disrupt
- Always use: "[Company]" (not [Company]), "Player Rating" or "[Company] Rating", "Player Intelligence" as the category
- Voice: confident expert friend, specific and data-backed, never generic
- Every claim needs a proof point. Vague is off-brand.`
}
