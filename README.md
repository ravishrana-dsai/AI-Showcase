# AI Showcase

A portfolio of AI-powered projects spanning multi-agent systems, voice AI pipelines, LLM-backed product tools, and intelligent automation. Built with Claude, Gemini, Pipecat, Next.js, Python, and TypeScript.

---

## Projects

| Project | What It Does | AI Stack |
|---|---|---|
| [AI Voice Interviewer](./ai-voice-interviewer) | Conducts structured 20-min voice interviews autonomously, scores candidates across 5 dimensions | Claude Sonnet 4.6, Deepgram, Cartesia, Pipecat, Daily.co WebRTC |
| [AI Marketing OS](./ai-marketing-os) | 11-tab multi-agent marketing command center with self-learning brain and cost tracking | Claude Sonnet 4.6, Claude Haiku 4.5, Gemini 2.5 Pro |
| [Competitive Intelligence Agent](./competitive-intel-agent) | Autonomous multi-agent CI pipeline: collects web signals, analyzes with LLMs, distributes via Slack | Claude Sonnet 4.6, Gemini 2.0 Flash, Playwright, APScheduler |
| [Talent Hub ATS](./talent-hub-ats) | Full-stack ATS with AI resume screening, interview scoring, Kanban pipeline | Claude Sonnet 4.6, Next.js 15, Turborepo, Redis, MinIO |
| [PRD to Feature](./prd-to-feature) | Converts a Product Requirements Doc into design spec + Next.js code in one click | Google Gemini 2.5 Pro, Next.js 14, Playwright |
| [Deck Generator](./deck-generator) | Turns bullet points into polished presentation decks with PPTX + Google Slides export | Google Gemini API, pptxgenjs, Puppeteer |
| [Slack Agentic Bot](./slack-agentic-bot) | Persistent Slack bot that classifies every message into structured tasks, content, and 1:1 notes | Claude Sonnet, Slack Bolt SDK, PostgreSQL |
| [Reddit AI Bot](./reddit-bot) | Claude-powered Reddit bot with browser automation, analytics dashboard, and human-like behavior | Claude Sonnet 4, Playwright, Python |
| [Claude Token Tracker](./claude-token-tracker) | Electron menubar app + Next.js dashboard for tracking Claude API cost per business unit | HTTPS proxy, SQLite, Gemini API (demo) |
| [Prompt Library](./prompt-library) | Centralized, versioned prompt management system with web UI | JSON schema, HTML frontend |
| [Tournament Tracker](./tournament-tracker) | Google Apps Script tournament management with bracket tracking and mobile-responsive UI | Google Apps Script, Google Sheets |
| [Courts Tracker](./courts-tracker) | Ops platform for court partner onboarding, SLA tracking, request pipelines, and alerts | Next.js, Prisma, PostgreSQL, Redis, NextAuth |
| [HRBP AI Copilot](./hrbp-copilot) | Paste 1:1 meeting notes, get structured HRBP analysis with risk flags, sentiment, and cross-session pattern tracking | Claude Sonnet 4.6, React, Express |
| [Sports Tech Brand Playbook](./brand-playbook) | 7-chapter AI-assisted brand bible: positioning, voice, messaging, visual identity, and content strategy | AI-assisted strategy (Claude) |

---

## Themes

**Multi-agent orchestration:** Several projects use LLM tool-calling loops where a master agent dynamically decides which specialist subagents to invoke (Competitive Intelligence Agent, AI Marketing OS).

**Voice AI pipelines:** The AI Voice Interviewer uses a full real-time pipeline: WebRTC audio in, Deepgram STT, Claude LLM, Cartesia TTS, audio back out, all coordinated by Pipecat.

**Cost-aware AI:** The Token Tracker tools measure AI spend at the business-unit level (cost per interview, cost per report), which is the metric that matters for AI product pricing.

**No-API automation:** The Reddit bot uses browser automation (Playwright) instead of the Reddit API, demonstrating how to build AI-powered automation without platform approval.

---

## Tech Highlights

- **LLMs:** Claude Sonnet 4.6, Claude Haiku 4.5, Gemini 2.5 Pro, Gemini 2.0 Flash
- **Voice:** Pipecat, Daily.co WebRTC, Deepgram Nova-2, Cartesia Sonic
- **Web:** Next.js 14-16, TypeScript, Tailwind CSS v4, Prisma, PostgreSQL
- **Automation:** Playwright, APScheduler, BullMQ, Redis
- **Infra:** Docker, AWS EC2, Electron, Google Apps Script
