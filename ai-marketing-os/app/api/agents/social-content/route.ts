import { createAgentRoute } from '@/lib/agent-handler'
import { getSocialContentPrompt } from '@/lib/prompts/social-content'
export const { GET, POST, PATCH } = createAgentRoute('social-content', getSocialContentPrompt)
