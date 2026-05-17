import { createAgentRoute } from '@/lib/agent-handler'
import { getListeningPrompt } from '@/lib/prompts/listening'
export const { GET, POST, PATCH } = createAgentRoute('listening', getListeningPrompt)
