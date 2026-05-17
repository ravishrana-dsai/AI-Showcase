# [Company] Brand Hub - Setup Guide

## Prerequisites

- Node.js 18+
- PostgreSQL database (provided via dpgo-deploy)
- Anthropic API key
- Gemini API key (fallback)

## 1. Environment Setup

Copy the example env file and fill it in:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgresql://user:password@host:5432/company_brand_hub
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
BRAND_BIBLE_PATH=..
```

`BRAND_BIBLE_PATH` points to the directory containing the Brand Bible `.md` files.
If the `hub/` folder is inside the Brand Bible folder (as it is now), `..` is correct.

## 2. Database Setup

Generate and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

Seed default monitored sources (Reddit subreddits and RSS feeds):

```bash
npm run db:seed
```

## 3. Run Locally

```bash
npm run dev
```

Open http://localhost:3000

## 4. Deploy via dpgo-deploy

```bash
/dpgo-deploy
```

Make sure all env vars are set in the deployment environment.

## What You Can Do From the Hub

### Studio
Brief an agent in plain language or using the structured form. The Director Agent interprets
your brief, picks the right format, and hands it to the Writer Agent. Content streams in
real time. Hit "Brand check" to score against the Brand Bible. Send to queue when ready.

**Supported content types:**
- Blog post (1,200 words)
- LinkedIn post (250 words)
- LinkedIn article (800 words)
- Reddit post / comment
- Newsletter section
- Press release

### Intelligence Feed
Reddit threads and news stories scored for relevance. Click "Write reply", "LinkedIn post",
or "Blog post" next to any item to generate a response. The agent uses the thread as context.

**Monitored by default:**
- r/padel, r/pickleball, r/tennis, r/sportsanalytics, r/MachineLearning
- Google News RSS for padel, pickleball, sports AI, padel ratings

Add more sources in Settings.

### Approval Queue
Every piece of AI-generated content lands here. Review, approve, reject. Approved content
can be marked as published once you've manually posted it. Copy button on every item.

### Calendar
Visual monthly calendar showing scheduled content. Click a day to see what's planned.

### Settings
- Add/remove/toggle monitored subreddits and RSS feeds
- See AI model configuration (Anthropic primary, Gemini fallback)
- Publishing is manual copy/paste for now (OAuth coming next phase)

## Architecture Notes

All agents use the Brand Bible as their persistent system prompt context. The brand-bible.ts
loader reads the 7 markdown files from the parent directory and concatenates them.

The AI stack: claude-sonnet-4-6 (primary) with automatic fallback to gemini-2.0-flash.
Both are accessed via the Vercel AI SDK for streaming support.

Reddit intelligence uses public JSON endpoints (no API key required). Rate-limited to
1 request/second to stay within Reddit's public rate limits.
