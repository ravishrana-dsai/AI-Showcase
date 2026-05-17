# Competitive Intelligence Agent

> An autonomous multi-agent system that continuously monitors competitors, collects signals from across the web, analyzes them with LLMs, detects strategic shifts, and distributes weekly intelligence briefs via Slack, fully automated.

## AI Stack

| Component | Technology |
|---|---|
| Primary LLM | Claude Sonnet 4.6 (Anthropic) |
| Fallback LLM | Google Gemini 2.0 Flash |
| Orchestration | Native Anthropic tool-calling loop |
| Web scraping | Playwright + BeautifulSoup |
| Scheduling | APScheduler (cron jobs) |

## Key Achievements

- Master orchestrator agent uses Claude's tool-calling loop to dynamically decide which of 7 specialist subagents to invoke and in what order, based on signal volume and priority
- 8 parallel collector agents run on independent cron schedules: News Feeds, App Reviews, Social Signals, Job Postings, Web Scraper, Pricing Pages, Trend Research, Patents
- 7 specialist processor agents: News Digest, Review Sentiment, Feature Gap Analysis, Hiring Signal Parser, Pricing Tracker, Narrative Diff, Trend Analyzer
- Hiring Signal Parser infers competitor product roadmap from job descriptions using LLM extraction
- Narrative Diff agent compares competitor messaging positioning to own positioning and surfaces strategic drift
- Weekly synthesis generates PRD-format markdown documents for product planning
- Content-hash deduplication across all collectors prevents redundant signal processing
- Full Flask dashboard at `localhost:5050` showing live signal flow and architecture

## Architecture

```
Scheduler (APScheduler, IST cron)
     |
     v
Team 1: Collectors (8 agents, parallel)
  News · App Reviews · Social · Jobs · Web · Pricing · Trends · Patents
     |
     v  (raw_signals table, SQLite WAL)
     |
Master Agent: CIOrchestrator
  LLM tool-calling loop decides processing order
     |
     v
Team 2: Processors (7 specialist subagents)
  News Digest · Sentiment · Feature Gap · Hiring Signal
  Pricing Tracker · Narrative Diff · Trend Analyzer
     |
     v
Weekly brief (Markdown + Slack notification)
```

## Tech Stack

- **Language:** Python 3
- **LLMs:** Anthropic SDK, Google Generative AI SDK
- **Scraping:** Playwright, BeautifulSoup, requests
- **DB:** SQLite (WAL mode, thread-local connections)
- **Scheduler:** APScheduler
- **Config:** Pydantic Settings
- **Dashboard:** Flask

## How to Run

```bash
pip install -r requirements.txt
cp .env.example .env   # add ANTHROPIC_API_KEY, GEMINI_API_KEY, etc.
python main.py         # starts collectors + processors on schedule
python dashboard.py    # optional: live dashboard at localhost:5050
```
