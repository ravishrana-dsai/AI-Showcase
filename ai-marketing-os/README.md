# AI Marketing OS

> A multi-agent marketing command center with 11 specialized AI tabs, a self-learning brain that extracts insights from approved outputs, real-time cost tracking, and brand context injection into every generation.

## AI Stack

| Component | Technology |
|---|---|
| Primary LLM | Claude Sonnet 4.6 (Anthropic) |
| Secondary LLM | Claude Haiku 4.5 (brain extraction, cost optimization) |
| Fallback LLM | Google Gemini 2.5 Pro |
| Framework | Next.js API routes (server-side LLM calls) |
| Database | PostgreSQL + Prisma (outputs, brain entries, cost logs) |

## Key Achievements

- 11 specialized AI agent tabs covering the full marketing funnel: strategy, copy, email sequences, social content, ad creatives, SEO, launch plans, and more
- Self-learning brain: every approved output gets analyzed by Claude Haiku, which extracts reusable insights and stores them. Future generations automatically inject the most relevant brain entries as context
- Real-time cost tracking per generation, per tab, and across the entire system. Know exactly what each piece of content costs in API spend
- Brand context injection: brand voice, tone, and positioning rules are automatically prepended to every prompt, ensuring consistent output without manual prompting
- Dual-LLM architecture: Claude Sonnet 4.6 generates, Claude Haiku 4.5 extracts and classifies (3x cost saving on extraction tasks)
- Gemini 2.5 Pro as automatic fallback if Anthropic API is unavailable

## Architecture

```
Browser (Next.js App Router)
     |
     v
API Routes (/api/generate/[tab])
     |-- Brand context injection
     |-- Brain retrieval (top-k relevant entries)
     |-- Claude Sonnet 4.6 generation
     |-- Cost logging to PostgreSQL
     v
Post-approval pipeline
     |-- Claude Haiku 4.5 extracts insights
     |-- Brain entries written to PostgreSQL
     |-- Available as context in future generations
```

## Tech Stack

- **Frontend:** Next.js 16.2 (App Router), TypeScript 5, Tailwind CSS 4, Shadcn/UI
- **Backend:** Next.js API routes, PostgreSQL, Prisma 7
- **AI:** Anthropic SDK (Claude Sonnet 4.6 + Haiku 4.5), Google Generative AI SDK (Gemini 2.5 Pro)
- **Charts:** Recharts (cost dashboards)
- **Port:** 9010 (local dev)

## How to Run

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY, GEMINI_API_KEY, DATABASE_URL
npm run db:push
npm run dev
```

Open http://localhost:9010.
