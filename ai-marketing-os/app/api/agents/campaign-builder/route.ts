import { createAgentRoute } from '@/lib/agent-handler'
import { getCampaignBuilderPrompt } from '@/lib/prompts/campaign-builder'
export const { GET, POST, PATCH } = createAgentRoute('campaign-builder', getCampaignBuilderPrompt)
