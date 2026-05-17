export type ContentType =
  | 'blog'
  | 'linkedin_post'
  | 'linkedin_article'
  | 'reddit_post'
  | 'reddit_comment'
  | 'newsletter'
  | 'press_release'

export type TargetAudience =
  | 'competitive_player'
  | 'casual_player'
  | 'tournament_player'
  | 'court_operator'
  | 'investor'
  | 'general'

export interface ContentBrief {
  type: ContentType
  topic: string
  targetAudience: TargetAudience
  keyPoints?: string[]
  tone?: string
  inspirationUrl?: string
  inspirationContext?: string
  wordCount?: number
}

export interface BrandCheckResult {
  score: number
  passed: boolean
  issues: BrandIssue[]
  suggestions: string[]
  summary: string
}

export interface BrandIssue {
  type: 'banned_word' | 'wrong_tone' | 'missing_proof' | 'off_message' | 'em_dash'
  severity: 'critical' | 'warning'
  text: string
  suggestion: string
}

export interface SeoResult {
  primaryKeyword: string
  secondaryKeywords: string[]
  metaDescription: string
  headlineSuggestions: string[]
  score: number
}

export interface ResearchResult {
  title: string
  url: string
  summary: string
  relevanceScore: number
  suggestedAngle: string
}
