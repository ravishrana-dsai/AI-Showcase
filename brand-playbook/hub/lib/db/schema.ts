import { pgTable, uuid, text, integer, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'

export const contentTypeEnum = pgEnum('content_type', [
  'blog',
  'linkedin_post',
  'linkedin_article',
  'reddit_post',
  'reddit_comment',
  'newsletter',
  'press_release',
])

export const contentStatusEnum = pgEnum('content_status', [
  'draft',
  'pending_review',
  'approved',
  'scheduled',
  'published',
  'rejected',
])

export const intelligenceSourceEnum = pgEnum('intelligence_source', [
  'reddit',
  'news',
  'rss',
])

export const intelligenceActionEnum = pgEnum('intelligence_action', [
  'ignored',
  'responded',
  'inspired_post',
])

export const platformEnum = pgEnum('platform', [
  'linkedin',
  'blog',
  'reddit',
  'newsletter',
])

export const scheduleStatusEnum = pgEnum('schedule_status', [
  'pending',
  'published',
  'failed',
])

export const monitoredSourceTypeEnum = pgEnum('monitored_source_type', [
  'subreddit',
  'rss',
  'news_keyword',
])

export const contentItems = pgTable('content_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  contentType: contentTypeEnum('content_type').notNull(),
  status: contentStatusEnum('status').notNull().default('draft'),
  brief: text('brief'),
  targetAudience: text('target_audience'),
  brandScore: integer('brand_score'),
  brandFeedback: text('brand_feedback'),
  seoKeywords: text('seo_keywords').array(),
  metaDescription: text('meta_description'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  platformUrl: text('platform_url'),
  inspiredBy: uuid('inspired_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const intelligenceItems = pgTable('intelligence_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: intelligenceSourceEnum('source').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  summary: text('summary'),
  body: text('body'),
  relevanceScore: integer('relevance_score'),
  subreddit: text('subreddit'),
  author: text('author'),
  upvotes: integer('upvotes'),
  commentCount: integer('comment_count'),
  action: intelligenceActionEnum('action').default('ignored'),
  relatedContentId: uuid('related_content_id').references(() => contentItems.id),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
})

export const contentSchedule = pgTable('content_schedule', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentId: uuid('content_id').references(() => contentItems.id).notNull(),
  platform: platformEnum('platform').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: scheduleStatusEnum('status').notNull().default('pending'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const monitoredSources = pgTable('monitored_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: monitoredSourceTypeEnum('type').notNull(),
  value: text('value').notNull(),
  label: text('label'),
  active: boolean('active').notNull().default(true),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ContentItem = typeof contentItems.$inferSelect
export type NewContentItem = typeof contentItems.$inferInsert
export type IntelligenceItem = typeof intelligenceItems.$inferSelect
export type NewIntelligenceItem = typeof intelligenceItems.$inferInsert
export type ContentScheduleItem = typeof contentSchedule.$inferSelect
export type MonitoredSource = typeof monitoredSources.$inferSelect
