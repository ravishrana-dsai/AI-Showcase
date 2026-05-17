import { createAgentRoute } from '@/lib/agent-handler'
import { getAnalyticsPrompt } from '@/lib/prompts/analytics'
export const { GET, POST, PATCH } = createAgentRoute('analytics', getAnalyticsPrompt)
