import { createAgentRoute } from '@/lib/agent-handler'
import { getInfluencerCRMPrompt } from '@/lib/prompts/influencer-crm'
export const { GET, POST, PATCH } = createAgentRoute('influencer-crm', getInfluencerCRMPrompt)
