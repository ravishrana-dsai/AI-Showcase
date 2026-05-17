import { createAgentRoute } from '@/lib/agent-handler'
import { getEmailWhatsAppPrompt } from '@/lib/prompts/email-whatsapp'
export const { GET, POST, PATCH } = createAgentRoute('email-whatsapp', getEmailWhatsAppPrompt)
