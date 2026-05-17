import { createAgentRoute } from '@/lib/agent-handler'
import { getBrandIdentityPrompt } from '@/lib/prompts/brand-identity'
export const { GET, POST, PATCH } = createAgentRoute('brand-identity', getBrandIdentityPrompt)
