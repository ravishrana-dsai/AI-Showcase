"""
[Company] Competitive Intelligence Bot
Entry point for both scheduled and manual runs.

Usage:
  python main.py                       Start the scheduler (runs indefinitely)
  python main.py --init-db             Initialize the SQLite database
  python main.py --test-slack          Post a test message to Slack
  python main.py --run-now             Run the full CI pipeline immediately
  python main.py --run-collector NEWS  Run a specific collector (news/reviews/social/jobs/web/pricing/trends/patents)
  python main.py --run-processor NEWS  Run a specific processor (news/reviews/features/hiring/pricing/narrative/trends)
  python main.py --list-jobs           List all scheduled jobs with next run times
  python main.py --list-prds           List all stored PRDs
  python main.py --run-trend-analysis  Run trend analysis + PRD generation immediately
  python main.py --weekly-brief        Post weekly brief immediately
"""

import argparse
import os
import signal
import sys
import time
from pathlib import Path

# Load .env before any other module reads os.getenv()
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

from utils.logger import setup_logging, get_logger

# Setup logging before any other imports that use the logger
setup_logging()
logger = get_logger(__name__)


def cmd_init_db():
    from db.database import initialize
    initialize()
    print("Database initialized successfully.")


def cmd_test_slack():
    from outputs.slack_client import post_test_message
    success = post_test_message()
    print("Slack test message sent." if success else "Slack test failed. Check SLACK_BOT_TOKEN and channel config.")


def cmd_run_collector(collector_name: str):
    from config.competitors import get_active_competitors
    competitors = get_active_competitors()
    name = collector_name.lower()

    if name == "news":
        from collectors.news_feeds import run_all_news_collectors
        count = run_all_news_collectors(competitors)
    elif name in ("reviews", "app_reviews"):
        from collectors.app_reviews import run_all_review_collectors
        count = run_all_review_collectors(competitors)
    elif name in ("social", "reddit"):
        from collectors.social_signals import run_all_social_collectors
        count = run_all_social_collectors(competitors)
    elif name in ("jobs", "job_postings"):
        from collectors.job_postings import run_all_job_collectors
        count = run_all_job_collectors(competitors)
    elif name in ("web", "web_scraper"):
        from collectors.web_scraper import run_all_web_scrapers
        count = run_all_web_scrapers(competitors)
    elif name in ("pricing", "prices"):
        from collectors.pricing_pages import run_all_pricing_collectors
        count = run_all_pricing_collectors(competitors)
    elif name in ("trends", "trend"):
        from collectors.trend_research import TrendResearchCollector
        count = TrendResearchCollector().run()
    elif name in ("patents", "patent"):
        from collectors.patent_filings import run_all_patent_collectors
        count = run_all_patent_collectors(competitors)
    elif name in ("twitter", "x"):
        from collectors.twitter_signals import run_all_twitter_collectors
        count = run_all_twitter_collectors(competitors)
    elif name in ("linkedin", "linkedin_monitor"):
        from collectors.linkedin_monitor import run_all_linkedin_monitors
        count = run_all_linkedin_monitors(competitors)
    else:
        print(f"Unknown collector: {collector_name}")
        print("Available: news, reviews, social, jobs, web, pricing, trends, patents, twitter, linkedin")
        return

    print(f"Collector '{name}' complete. New signals: {count}")


def cmd_run_processor(processor_name: str):
    import json
    name = processor_name.lower()

    try:
        if name == "news":
            from processors.news_digest import NewsDigestProcessor
            result = NewsDigestProcessor().run_all()
        elif name in ("reviews", "sentiment"):
            from processors.review_sentiment import ReviewSentimentProcessor
            result = ReviewSentimentProcessor().run_all()
        elif name in ("features", "feature_gap"):
            from processors.feature_gap_tracker import FeatureGapTracker
            result = FeatureGapTracker().run_all()
        elif name in ("hiring", "jobs"):
            from processors.hiring_signal_parser import HiringSignalParser
            result = HiringSignalParser().run_all()
        elif name in ("pricing", "prices"):
            from processors.pricing_tracker import PricingTracker
            result = PricingTracker().run_all()
        elif name in ("narrative", "messaging"):
            from processors.narrative_diff import NarrativeDiffEngine
            result = NarrativeDiffEngine().run_all() if hasattr(NarrativeDiffEngine(), "run_all") else {}
        elif name in ("trends", "trend"):
            from processors.trend_analyzer import TrendAnalyzer
            result = TrendAnalyzer().synthesize()
        elif name in ("profiles", "profile"):
            from processors.company_profile_extractor import run_all_profile_extractions
            from config.competitors import get_active_competitors
            competitors = get_active_competitors()
            updated = run_all_profile_extractions(competitors)
            result = {"updated": updated, "total": len(competitors)}
        elif name in ("social", "social_mentions"):
            from processors.social_mention_analyzer import SocialMentionAnalyzer
            result = SocialMentionAnalyzer().run_all()
        else:
            print(f"Unknown processor: {processor_name}")
            print("Available: news, reviews, features, hiring, pricing, narrative, trends, profiles, social")
            return
    except ValueError as e:
        if "No AI provider key" in str(e):
            print(f"No LLM API key configured. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to .env")
        else:
            print(f"Error: {e}")
        return
    except Exception as e:
        print(f"Processor failed: {e}")
        return

    print(f"Processor '{name}' complete.")
    print(json.dumps(result, indent=2)[:2000])


def cmd_run_now():
    try:
        from processors.orchestrator import CIOrchestrator
        logger.info("Running full CI pipeline")
        orchestrator = CIOrchestrator()
        synthesis = orchestrator.run_full_pipeline()
        print("\nOrchestrator synthesis:")
        print(synthesis[:1000] if synthesis else "(no output)")
    except ValueError as e:
        if "No AI provider key" in str(e):
            print("No LLM API key configured. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to .env")
        else:
            print(f"Error: {e}")
        return

    # Send any pending alerts
    from outputs.roadmap_alerts import send_pending_alerts
    alerts = send_pending_alerts()
    print(f"Alerts sent: {alerts}")


def cmd_list_jobs(scheduler):
    print("\nScheduled Jobs:")
    print("-" * 60)
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        next_str = next_run.strftime("%Y-%m-%d %H:%M %Z") if next_run else "Not scheduled"
        print(f"  {job.name:<40} Next: {next_str}")
    print("-" * 60)


def cmd_list_prds():
    from db.database import get_recent_prd_summaries
    from db import database
    with database.get_db() as conn:
        rows = conn.execute(
            "SELECT title, week, priority_score, effort, created_at FROM prds ORDER BY created_at DESC"
        ).fetchall()
        prds = [dict(r) for r in rows]

    if not prds:
        print("No PRDs stored yet.")
        return

    print(f"\nStored PRDs ({len(prds)} total):")
    print("-" * 80)
    for prd in prds:
        print(f"  [{prd['week']}] {prd['title']:<50} P:{prd.get('priority_score','?')}/10  E:{prd.get('effort','?')}")
    print("-" * 80)


def cmd_run_trend_analysis():
    from processors.trend_analyzer import TrendAnalyzer
    from datetime import date
    analyzer = TrendAnalyzer()
    prds = analyzer.run()
    print(f"\nTrend analysis complete. PRDs generated: {len(prds)}")
    for prd in prds:
        print(f"  - {prd.get('title', '?')} (P:{prd.get('priority_score','?')}, E:{prd.get('effort','?')})")
        print(f"    {prd.get('concept_summary','')[:100]}")

    # Post to Slack
    if prds:
        week = f"{date.today().isocalendar()[0]}-W{date.today().isocalendar()[1]:02d}"
        from outputs.prd_generator import post_weekly_prd_summary
        post_weekly_prd_summary(week)


def cmd_weekly_brief():
    from outputs.weekly_brief import post_weekly_brief
    success = post_weekly_brief()
    print("Weekly brief posted." if success else "Weekly brief failed. Check Slack config.")


def main():
    parser = argparse.ArgumentParser(description="[Company] CI Bot")
    parser.add_argument("--init-db", action="store_true", help="Initialize the database")
    parser.add_argument("--test-slack", action="store_true", help="Post a test Slack message")
    parser.add_argument("--run-now", action="store_true", help="Run full pipeline immediately")
    parser.add_argument("--run-collector", metavar="NAME", help="Run a specific collector")
    parser.add_argument("--run-processor", metavar="NAME", help="Run a specific processor")
    parser.add_argument("--list-jobs", action="store_true", help="List scheduled jobs")
    parser.add_argument("--list-prds", action="store_true", help="List stored PRDs")
    parser.add_argument("--run-trend-analysis", action="store_true", help="Run trend analysis + PRD generation")
    parser.add_argument("--weekly-brief", action="store_true", help="Post weekly brief immediately")
    parser.add_argument("--dashboard", action="store_true", help="Open live terminal dashboard")
    parser.add_argument("--snapshot", action="store_true", help="Print static dashboard snapshot")
    parser.add_argument("--web", action="store_true", help="Open web dashboard at http://localhost:5050")

    args = parser.parse_args()

    if args.init_db:
        cmd_init_db()
        return

    # Ensure all tables exist (idempotent with CREATE TABLE IF NOT EXISTS)
    from db.database import initialize
    initialize()

    if args.test_slack:
        cmd_test_slack()
        return

    if args.run_collector:
        cmd_run_collector(args.run_collector)
        return

    if args.run_processor:
        cmd_run_processor(args.run_processor)
        return

    if args.run_now:
        cmd_run_now()
        return

    if args.run_trend_analysis:
        cmd_run_trend_analysis()
        return

    if args.weekly_brief:
        cmd_weekly_brief()
        return

    if args.list_prds:
        cmd_list_prds()
        return

    if args.dashboard:
        from dashboard import run_dashboard
        run_dashboard()
        return

    if args.snapshot:
        from dashboard import run_static_snapshot
        run_static_snapshot()
        return

    if args.web:
        import subprocess
        subprocess.run([sys.executable, str(Path(__file__).parent / "web_dashboard.py")])
        return

    # Default: start scheduler
    from scheduler.jobs import create_scheduler
    scheduler = create_scheduler()

    if args.list_jobs:
        scheduler.start()
        cmd_list_jobs(scheduler)
        scheduler.shutdown()
        return

    logger.info("Starting [Company] CI Bot scheduler")
    scheduler.start()

    # Fire any daily jobs that were missed while the laptop was off
    from scheduler.jobs import run_missed_jobs
    run_missed_jobs()

    # Print next run times on start
    cmd_list_jobs(scheduler)
    print("\nScheduler running. Press Ctrl+C to stop.\n")

    def _shutdown(signum, frame):
        logger.info("Shutting down scheduler")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        _shutdown(None, None)


if __name__ == "__main__":
    main()
