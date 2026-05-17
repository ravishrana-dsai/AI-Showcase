# [Company] Competitive Intelligence Agent — Architecture Overview

---

## What It Does

An autonomous multi-agent system that continuously monitors competitors of **[Company]** (sports tech — Padel & Pickleball). It collects signals from across the web, analyzes them with LLMs, detects strategic changes, and distributes intelligence via Slack — automatically, on a schedule.

---

## How It Was Built

| Layer | Choice | Why |
|---|---|---|
| LLMs | Claude Sonnet (primary), Gemini 2.0 Flash (fallback) | Tool-calling loop + structured JSON output |
| Orchestration | Native Anthropic tool-calling via `LLMClient.complete_with_tools()` | LLM decides which processors to invoke and in what order |
| Database | SQLite (WAL mode, thread-local connections) | Lightweight, embedded, zero-ops |
| Scheduler | APScheduler (IST cron jobs) | Missed-job recovery via `last_run_times.json` |
| Web UI | Flask dashboard on `localhost:5050` | Architecture diagram + live signal view |
| Scraping | Playwright + BeautifulSoup + requests | Handles JS-heavy and static pages |
| Config | Pydantic Settings + `.env` | Type-safe env vars, easy local override |

All agents share two abstract base classes — `BaseCollector` and `BaseProcessor` — enforcing a consistent interface across the system.

---

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MASTER AGENT                           │
│              CIOrchestrator  (processors/orchestrator.py)   │
│                                                             │
│  • Receives: unprocessed signal counts + recent changes     │
│  • Uses LLM tool-calling loop to decide which processors    │
│    to invoke and in what sequence                           │
│  • Priority: Funding > Pricing > Features > Hiring >        │
│              Sentiment > News                               │
│  • Synthesizes all outputs into a final weekly brief        │
└───────────────┬─────────────────────────────────────────────┘
                │ invokes via tool calls
                ▼
┌─────────────────────────────────────────────────────────────┐
│                   TEAM 2 — PROCESSORS                       │
│              7 Specialist Analysis Subagents                │
│                                                             │
│  ┌──────────────────┐   ┌──────────────────────────────┐   │
│  │ News Digest       │   │ Review Sentiment              │   │
│  │ Score relevance,  │   │ App Store / Play Store pain   │   │
│  │ extract signals   │   │ points and praise             │   │
│  └──────────────────┘   └──────────────────────────────┘   │
│  ┌──────────────────┐   ┌──────────────────────────────┐   │
│  │ Feature Gap       │   │ Hiring Signal Parser          │   │
│  │ Competitor vs     │   │ Infer competitor roadmap      │   │
│  │ [Company]        │   │ from job postings             │   │
│  └──────────────────┘   └──────────────────────────────┘   │
│  ┌──────────────────┐   ┌──────────────────────────────┐   │
│  │ Pricing Tracker   │   │ Narrative Diff                │   │
│  │ Tier changes,     │   │ Competitor messaging vs       │   │
│  │ pricing diffs     │   │ [Company] positioning        │   │
│  └──────────────────┘   └──────────────────────────────┘   │
│  ┌──────────────────┐                                       │
│  │ Trend Analyzer    │  ← synthesizes weekly signals +      │
│  │ Weekly synthesis  │    generates PRD markdown files      │
│  └──────────────────┘                                       │
└───────────────┬─────────────────────────────────────────────┘
                │ reads from DB / writes processed_intelligence
                ▼
┌─────────────────────────────────────────────────────────────┐
│                   TEAM 1 — COLLECTORS                       │
│              8 Parallel Signal Collection Agents            │
│                                                             │
│  News Feeds · App Reviews · Social Signals · Job Postings   │
│  Web Scraper · Pricing Pages · Trend Research · Patents     │
│                                                             │
│  Each collector runs on its own schedule (IST cron),        │
│  deduplicates by content hash, and writes to raw_signals    │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                   TEAM 3 — OUTPUTS                          │
│              Multi-Channel Distribution                     │
│                                                             │
│  Weekly Brief → Slack    Battle Cards → Slack               │
│  Roadmap Alerts → Slack  PRD Summaries → Slack              │
│  Changelog tracking      outputs_sent dedup table           │
└─────────────────────────────────────────────────────────────┘
```

---

## End-to-End Signal Flow

```
1. COLLECT    Collectors run on schedule → insert raw_signals (processed=0)
      ↓
2. TRIGGER    main.py --run-now  OR  APScheduler fires orchestration job
      ↓
3. ORCHESTRATE  CIOrchestrator asks LLM: "given these signals, what to analyze?"
      ↓
4. PROCESS    LLM tool-calls invoke specialist processors in priority order
              Each processor: reads DB → calls LLM → writes processed_intelligence
      ↓
5. DETECT     Processors hash snapshots → compare with previous → write to changes
      ↓
6. DISTRIBUTE  Weekly brief, battle cards, alerts, and PRDs posted to Slack
```

---

## Collection Schedule (IST)

| Frequency | Agents |
|---|---|
| Daily (weekdays) | News, App Reviews, Social, Job Postings, Change Detection |
| Bi-weekly (Mon + Thu) | Web Scraper, Pricing Pages |
| Weekly Friday | Battle Cards, Trend Analysis + PRD Generation |
| Weekly Monday | Weekly Brief |
| Weekly Saturday | Patent Filings |

---

## Database Schema (SQLite)

`raw_signals` → `processed_intelligence` → `competitor_snapshots` → `changes`  
`prds` · `outputs_sent` · `jobs_seen`

---

## Key Design Decisions

- **LLM-driven orchestration** — the Master Agent uses a tool-calling loop so the LLM dynamically decides which processors are relevant, rather than running all processors every time.
- **Dual LLM fallback** — Anthropic native tool-calling; Gemini simulated when Anthropic is unavailable.
- **Content hashing for change detection** — avoids re-processing unchanged competitor pages.
- **Thread-local SQLite connections** — safe concurrent access across scheduled jobs.
- **Missed-job recovery** — `last_run_times.json` re-runs jobs that were skipped due to downtime.
