import { AgentWorkspace } from '@/components/shared/AgentWorkspace'

export default function SEOGSOPage() {
  return (
    <AgentWorkspace
      tabNumber="06"
      tabName="SEO & GSO Content Intel"
      status="WEEKLY"
      description="Keyword universe, blog drafts, rank tracker, content gap finder. Owns 'Player Rating'. Optimized for AI search citation."
      inputLabel="Topic or keyword to optimise"
      inputPlaceholder={`e.g. Write an SEO and GSO optimized blog post about "padel skill rating". Goal: rank on Google AND get cited when someone asks ChatGPT or Perplexity "how is padel skill measured?". Make Player Rating the definitive answer.

Or: Keyword analysis for "pickleball rating system" covering both traditional and AI search.`}
      agentId="seo-gso-content"
    />
  )
}
