import { createAgentRoute } from '@/lib/agent-handler'
import { getTournamentEnginePrompt } from '@/lib/prompts/tournament-engine'
export const { GET, POST, PATCH } = createAgentRoute('tournament-engine', getTournamentEnginePrompt)
