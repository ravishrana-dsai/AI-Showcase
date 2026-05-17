# [Company] CI Bot — System Context

## Version
Phase 2 complete as of 2026-03-17.

## What This Is
An automated competitive intelligence pipeline for [Company] (a padel/pickleball video AI platform).
Monitors 25+ competitors across 8 signal types, processes signals via Claude LLM, and outputs insights to Slack and a web dashboard.

## Current State
- **Signals collected:** 325 (143 job_postings, 92 social, 65 trend, 16 news, 8 pricing, 1 web_page)
- **Signals processed by LLM:** 2 (feature_gap for playtomic, news_digest for dink)
- **Unprocessed backlog:** 243 signals
- **Changes detected:** 0
- **PRDs generated:** 6 (from week 2026-W12)
- **Slack outputs sent:** 0
- **Competitors tracked:** 25 active

## Architecture
- **Collectors (8):** news_feeds, app_reviews, social_signals, job_postings, web_scraper, pricing_pages, trend_research, patent_filings
- **Processors (7):** feature_gap_tracker, review_sentiment, hiring_signal_parser, pricing_tracker, news_digest, narrative_diff, trend_analyzer
- **Orchestrator:** Master agentic coordinator (`processors/orchestrator.py`) — uses Claude tool-calling to run specialist processors
- **DB:** SQLite at `data/ci_bot.db` (WAL mode, 7 tables)
- **Dashboard:** Flask SPA at localhost:5050 (7 tabs)
- **Scheduler:** APScheduler, 14 jobs, Asia/Kolkata timezone

## Dashboard Tabs (current order)
Overview | Agent Summary | Inputs | Collectors | Competitors | Outputs | PRDs

### Tab Descriptions
- **Overview:** Stats row (signals, unprocessed, changes, alerts, PRDs, intel reports, jobs tracked), signals-by-type bar chart, top competitors table, recent changes, recent PRDs preview
- **Agent Summary:** Architecture diagram, run controls for each collector/processor, scheduler status, processor status table, live activity log
- **Inputs:** API key management, competitor list with active toggles, add-competitor form
- **Collectors:** 8 collector cards (click to drill into raw signals), signal detail panel with field-by-field view + Show Full JSON
- **Competitors:** Master-detail view — list panel (search, tier/sport badges, signal count) + detail panel (signals by type, latest intel, detected changes, raw signal cards, external links)
- **Outputs:** Research Feed (default — processed intel + news + trends + social + pricing + hiring), Battle Cards, Weekly Brief, Changelog, Alerts, Sent to Slack
- **PRDs:** Generated PRD list with priority/effort scores, click to read full markdown

## Competitor Config
- **Source:** `config/competitors.py` (25 active competitors, 1 inactive)
- **Runtime overrides:** `data/competitors_custom.json` (add/toggle without editing Python source)
- **Mandatory sports:** All competitors have padel + pickleball enforced at API layer (`get_all_competitors()`)
- **Tiers:** direct (primary competitors), adjacent (tangential), market (general trends)

## Key Files
| File | Purpose |
|------|---------|
| `web_dashboard.py` | Flask SPA — all HTML/CSS/JS embedded, all API routes |
| `config/competitors.py` | 25 competitor configs (name, sport, tier, website, keywords, store IDs, social handles) |
| `config/settings.py` | App settings (DB path, API keys, Slack channels, scheduler config) |
| `data/competitors_custom.json` | Runtime competitor additions and active overrides |
| `scheduler/jobs.py` | All 14 scheduled jobs with APScheduler |
| `processors/orchestrator.py` | Master agentic coordinator (Claude tool-calling loop, 8 max iterations) |
| `outputs/slack_client.py` | Slack Block Kit client (post, update, Block builders) |
| `outputs/weekly_brief.py` | Monday weekly CI brief formatter |
| `outputs/battle_card.py` | Per-competitor one-pager, updatable in-place on Slack |
| `outputs/prd_generator.py` | Formats + deduplicates PRDs, saves to disk + DB, posts to Slack |
| `outputs/roadmap_alerts.py` | Sends critical/high changes to #ci-alerts |
| `db/database.py` | SQLite connection management (WAL, per-thread) |
| `db/schema.sql` | Full DB schema |
| `utils/llm_client.py` | Anthropic/Gemini wrapper with tool-calling and retry |
| `utils/diff_engine.py` | Snapshot diffing and severity classification |
| `data/ci_bot.db` | Primary SQLite database |
| `.env` | API keys: ANTHROPIC_API_KEY, GEMINI_API_KEY, NEWSAPI_KEY, SLACK_BOT_TOKEN |

## DB Tables
| Table | Purpose |
|-------|---------|
| `raw_signals` | All collected signals (signal_type, raw_content JSON, source_url, content_hash, processed flag) |
| `processed_intelligence` | LLM analysis output (processor_type, analysis_json, confidence_score) |
| `competitor_snapshots` | Point-in-time snapshots for change detection |
| `changes` | Detected diffs between snapshots (severity: low/medium/high/critical, alerted flag) |
| `outputs_sent` | Slack message log (for dedup and in-place updates) |
| `jobs_seen` | Job posting deduplication (job_hash unique key) |
| `prds` | Generated PRDs (feature_slug, title, concept_hash, priority_score, effort S/M/L, week) |

## Collector Schedule (IST)
| Time | Days | Collector |
|------|------|-----------|
| 11:30am | Weekdays | News feeds |
| 11:45am | Weekdays | App reviews |
| 12:00pm | Weekdays | Social signals (Reddit + YouTube) |
| 12:15pm | Weekdays | Job postings (Greenhouse + LinkedIn) |
| 12:30pm | Weekdays | Change detection + Slack alerts |
| 2:00pm | Mon/Thu | Web scraper (Playwright) |
| 3:00pm | Mon/Thu | Pricing pages (Playwright) |
| 1:00pm | Tue/Fri | Trend research (HN, arXiv, Product Hunt) |
| 11:00am | Saturday | Patent filings (USPTO) |
| 12:00pm | Monday | Weekly CI brief to Slack |
| 4:00pm | Friday | Battle cards to Slack |
| 5:30pm | Friday | Trend analysis + PRD generation |

## External APIs Used
| API | Purpose | Auth |
|-----|---------|------|
| Anthropic Claude | LLM for all analysis | ANTHROPIC_API_KEY |
| Google Gemini | LLM fallback | GEMINI_API_KEY |
| NewsAPI | News article discovery | NEWSAPI_KEY |
| Slack Web API | Post/update Slack messages | SLACK_BOT_TOKEN |
| Reddit public JSON | Social signals | None (public) |
| Google Play Scraper | Android app reviews | None (library) |
| iTunes RSS | iOS app reviews | None (public) |
| Greenhouse public API | Job postings | None (public) |
| USPTO eFTS | Patent search | None (public) |
| Playwright | Web/pricing scraping | None (browser automation) |

## Slack Channels
| Channel | Purpose |
|---------|---------|
| `#competitive-intel` | Weekly CI briefs |
| `#ci-alerts` | High/critical competitor changes |
| `#ci-prds` | Weekly PRD summaries |
| `#admin` | System health messages |

## Known Gaps (Phase 3 targets)
1. **P0:** 243 signals unprocessed — LLM pipeline needs to run on backlog
2. **P1:** No competitive matrix/comparison view
3. **P2:** No Twitter/X collector despite twitter_handles in config
4. **P3:** PRDs have no lifecycle status (accepted/in-progress/shipped/rejected)
5. **P4:** Email digest not implemented (Slack only)
6. **P5:** App reviews sparse for most competitors with store IDs
7. **P6:** No composite threat score per competitor
8. **P7:** LinkedIn company page posts not monitored (only job postings)
