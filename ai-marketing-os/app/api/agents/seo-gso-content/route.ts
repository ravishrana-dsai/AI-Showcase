import { createAgentRoute } from '@/lib/agent-handler'
import { getSEOGSOPrompt } from '@/lib/prompts/seo-gso-content'
export const { GET, POST, PATCH } = createAgentRoute('seo-gso-content', getSEOGSOPrompt)
