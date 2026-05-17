import { createAgentRoute } from '@/lib/agent-handler'
import { getCourtPartnerPrompt } from '@/lib/prompts/court-partner'
export const { GET, POST, PATCH } = createAgentRoute('court-partner', getCourtPartnerPrompt)
