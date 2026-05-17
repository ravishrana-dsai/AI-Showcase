"""
APScheduler job definitions for the [Company] CI Bot.
All times are in IST (Asia/Kolkata).

Schedule policy:
  - All daily jobs run on weekdays only (mon-fri), starting at 11:30am IST
  - Staggered in 15-min intervals to avoid overlap
  - misfire_grace_time=86400 (24h): if the laptop was off at run time,
    the job fires as soon as the scheduler comes back online
  - On startup, run_missed_jobs() checks which jobs haven't run today
    and fires any that are overdue
"""

from __future__ import annotations

import json
from datetime import datetime, date, timedelta
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

# Track last-run timestamps so missed-run recovery knows what to skip
_LAST_RUN_FILE = Path(__file__).parent.parent / "data" / "last_run_times.json"

GRACE_PERIOD = 86400  # 24 hours — job fires even if the laptop was off at scheduled time


def _record_run(job_id: str) -> None:
    """Persist the last run time for a job to disk."""
    try:
        _LAST_RUN_FILE.parent.mkdir(parents=True, exist_ok=True)
        data: dict = {}
        if _LAST_RUN_FILE.exists():
            try:
                data = json.loads(_LAST_RUN_FILE.read_text())
            except Exception:
                data = {}
        data[job_id] = datetime.utcnow().isoformat()
        _LAST_RUN_FILE.write_text(json.dumps(data, indent=2))
    except Exception as exc:
        logger.warning("Could not record run time", job_id=job_id, error=str(exc))


def _last_run(job_id: str) -> datetime | None:
    """Return the last run time for a job, or None."""
    try:
        if not _LAST_RUN_FILE.exists():
            return None
        data = json.loads(_LAST_RUN_FILE.read_text())
        ts = data.get(job_id)
        return datetime.fromisoformat(ts) if ts else None
    except Exception:
        return None


def _run_daily_news():
    from config.competitors import get_active_competitors
    from collectors.news_feeds import run_all_news_collectors
    count = run_all_news_collectors(get_active_competitors())
    logger.info("Daily news job complete", new_signals=count)
    _record_run("daily_news")


def _run_daily_reviews():
    from config.competitors import get_active_competitors
    from collectors.app_reviews import run_all_review_collectors
    count = run_all_review_collectors(get_active_competitors())
    logger.info("Daily reviews job complete", new_signals=count)
    _record_run("daily_reviews")


def _run_daily_social():
    from config.competitors import get_active_competitors
    from collectors.social_signals import run_all_social_collectors
    count = run_all_social_collectors(get_active_competitors())
    logger.info("Daily social job complete", new_signals=count)
    _record_run("daily_social")


def _run_daily_jobs():
    from config.competitors import get_active_competitors
    from collectors.job_postings import run_all_job_collectors
    count = run_all_job_collectors(get_active_competitors())
    logger.info("Daily jobs collection complete", new_signals=count)
    _record_run("daily_jobs")


def _run_change_detection_and_alerts():
    from outputs.roadmap_alerts import send_pending_alerts
    count = send_pending_alerts()
    logger.info("Change detection + alerts job complete", alerts_sent=count)
    _record_run("change_detection")


def _run_web_scrape():
    from config.competitors import get_active_competitors
    from collectors.web_scraper import run_all_web_scrapers
    count = run_all_web_scrapers(get_active_competitors())
    logger.info("Web scrape job complete", new_signals=count)
    _record_run("web_scrape")


def _run_pricing_scrape():
    from config.competitors import get_active_competitors
    from collectors.pricing_pages import run_all_pricing_collectors
    count = run_all_pricing_collectors(get_active_competitors())
    logger.info("Pricing scrape job complete", new_signals=count)
    _record_run("pricing_scrape")


def _run_trend_research():
    from collectors.trend_research import TrendResearchCollector
    collector = TrendResearchCollector()
    count = collector.run()
    logger.info("Trend research job complete", new_signals=count)
    _record_run("trend_research")


def _run_patent_collection():
    from config.competitors import get_active_competitors
    from collectors.patent_filings import run_all_patent_collectors
    count = run_all_patent_collectors(get_active_competitors())
    logger.info("Patent collection job complete", new_signals=count)
    _record_run("patents")


def _run_twitter_collection():
    """Collect recent tweets for all competitors with twitter_handle."""
    from config.competitors import get_active_competitors
    from collectors.twitter_signals import run_all_twitter_collectors
    count = run_all_twitter_collectors(get_active_competitors())
    logger.info("Twitter collection complete", new_signals=count)
    _record_run("twitter_collection")


def _run_linkedin_monitoring():
    """Scrape LinkedIn company page posts for all active competitors."""
    from config.competitors import get_active_competitors
    from collectors.linkedin_monitor import run_all_linkedin_monitors
    count = run_all_linkedin_monitors(get_active_competitors())
    logger.info("LinkedIn monitoring complete", new_signals=count)
    _record_run("linkedin_monitoring")


def _run_profile_extraction():
    """Extract structured profiles from web/pricing signals for all competitors."""
    from config.competitors import get_active_competitors
    from processors.company_profile_extractor import run_all_profile_extractions
    count = run_all_profile_extractions(get_active_competitors())
    logger.info("Profile extraction complete", updated=count)
    _record_run("profile_extraction")


def _run_source_performance_rollup():
    """Compute weekly source quality and eval rollup. Runs Sunday 9pm IST."""
    from processors.source_performance_rollup import run_weekly_rollup
    run_weekly_rollup()
    _record_run("source_performance_rollup")


def _run_trend_analysis_and_prds():
    from processors.trend_analyzer import TrendAnalyzer
    analyzer = TrendAnalyzer()
    prds = analyzer.run()
    logger.info("Trend analysis + PRD generation complete", prds_generated=len(prds))
    week = f"{date.today().isocalendar()[0]}-W{date.today().isocalendar()[1]:02d}"
    if prds:
        from outputs.prd_generator import post_weekly_prd_summary
        post_weekly_prd_summary(week)
    _record_run("trend_analysis")


def _run_weekly_brief():
    from outputs.weekly_brief import post_weekly_brief
    success = post_weekly_brief()
    logger.info("Weekly brief job complete", success=success)
    _record_run("weekly_brief")


def _run_battle_cards():
    from config.competitors import get_active_competitors
    from outputs.battle_card import regenerate_all_battle_cards
    from processors.orchestrator import CIOrchestrator
    orchestrator = CIOrchestrator()
    orchestrator.run_targeted(["news", "web_page"])
    count = regenerate_all_battle_cards(get_active_competitors())
    logger.info("Battle cards job complete", cards_generated=count)
    _record_run("battle_cards")


# ── Missed-run recovery ───────────────────────────────────────────────────────

def run_missed_jobs() -> None:
    """
    Called once on startup. For each weekday-daily job that should have
    run today (IST) but has no recorded run since midnight, fire it immediately.
    Only triggers on weekdays (Mon-Fri).
    """
    import threading
    from zoneinfo import ZoneInfo

    tz = ZoneInfo(settings.scheduler_timezone)
    now_ist = datetime.now(tz)

    # Only recover on weekdays
    if now_ist.weekday() >= 5:
        logger.info("Missed-run recovery skipped: weekend")
        return

    today_midnight = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)

    # Jobs that run every weekday and their scheduled hour (IST)
    daily_jobs = [
        ("daily_news",       11, 30, _run_daily_news),
        ("daily_reviews",    11, 45, _run_daily_reviews),
        ("daily_social",     12,  0, _run_daily_social),
        ("daily_jobs",       12, 15, _run_daily_jobs),
        ("change_detection", 12, 30, _run_change_detection_and_alerts),
    ]

    for job_id, sched_hour, sched_min, fn in daily_jobs:
        scheduled_today = now_ist.replace(hour=sched_hour, minute=sched_min, second=0, microsecond=0)
        # Only recover if the scheduled time has already passed today
        if now_ist < scheduled_today:
            continue
        last = _last_run(job_id)
        if last is None or last < today_midnight.replace(tzinfo=None):
            logger.info("Missed-run recovery: firing overdue job", job_id=job_id)
            threading.Thread(target=fn, name=f"recovery-{job_id}", daemon=True).start()


# ── Scheduler factory ─────────────────────────────────────────────────────────

def create_scheduler() -> BackgroundScheduler:
    """Create and configure the APScheduler instance.

    All daily jobs:
      - Weekdays only (mon-fri)
      - Start at 11:30 IST, staggered 15 min apart
      - misfire_grace_time=86400 so APScheduler auto-fires missed jobs
        when the process restarts (covers brief laptop-off gaps < 24h)
    """
    tz = settings.scheduler_timezone
    scheduler = BackgroundScheduler(timezone=tz)

    # ── Daily weekday jobs — 11:30am IST onwards ──────────────────────────
    scheduler.add_job(
        _run_daily_news,
        CronTrigger(day_of_week="mon-fri", hour=11, minute=30, timezone=tz),
        id="daily_news", name="Daily News Collection",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )
    scheduler.add_job(
        _run_daily_reviews,
        CronTrigger(day_of_week="mon-fri", hour=11, minute=45, timezone=tz),
        id="daily_reviews", name="Daily App Reviews",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )
    scheduler.add_job(
        _run_daily_social,
        CronTrigger(day_of_week="mon-fri", hour=12, minute=0, timezone=tz),
        id="daily_social", name="Daily Social Signals",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )
    scheduler.add_job(
        _run_daily_jobs,
        CronTrigger(day_of_week="mon-fri", hour=12, minute=15, timezone=tz),
        id="daily_jobs", name="Daily Job Postings",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )
    scheduler.add_job(
        _run_change_detection_and_alerts,
        CronTrigger(day_of_week="mon-fri", hour=12, minute=30, timezone=tz),
        id="change_detection", name="Change Detection + Alerts",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )

    # ── Bi-weekly Playwright jobs — Mon/Thu afternoon ─────────────────────
    scheduler.add_job(
        _run_web_scrape,
        CronTrigger(day_of_week="mon,thu", hour=14, minute=0, timezone=tz),
        id="web_scrape", name="Bi-weekly Web Scrape",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )
    scheduler.add_job(
        _run_pricing_scrape,
        CronTrigger(day_of_week="mon,thu", hour=15, minute=0, timezone=tz),
        id="pricing_scrape", name="Bi-weekly Pricing Scrape",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )

    # Twitter/X collection — weekdays 12:05pm (right after social signals)
    scheduler.add_job(
        _run_twitter_collection,
        CronTrigger(day_of_week="mon-fri", hour=12, minute=5, timezone=tz),
        id="twitter_collection", name="Daily Twitter/X Signals",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )

    # ── Twice-weekly trend research — Tue/Fri after lunch ─────────────────
    scheduler.add_job(
        _run_trend_research,
        CronTrigger(day_of_week="tue,fri", hour=13, minute=0, timezone=tz),
        id="trend_research", name="Trend Research",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )

    # ── Weekly jobs ───────────────────────────────────────────────────────
    scheduler.add_job(
        _run_weekly_brief,
        CronTrigger(day_of_week="mon", hour=12, minute=0, timezone=tz),
        id="weekly_brief", name="Weekly CI Brief",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )
    scheduler.add_job(
        _run_battle_cards,
        CronTrigger(day_of_week="fri", hour=16, minute=0, timezone=tz),
        id="battle_cards", name="Battle Card Refresh",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )
    scheduler.add_job(
        _run_trend_analysis_and_prds,
        CronTrigger(day_of_week="fri", hour=17, minute=30, timezone=tz),
        id="trend_analysis", name="Weekly Trend Analysis + PRDs",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )
    scheduler.add_job(
        _run_patent_collection,
        CronTrigger(day_of_week="sat", hour=11, minute=0, timezone=tz),
        id="patents", name="Weekly Patent Collection",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )

    # LinkedIn company page posts — Wednesdays 2pm (separate from Playwright jobs)
    scheduler.add_job(
        _run_linkedin_monitoring,
        CronTrigger(day_of_week="wed", hour=14, minute=0, timezone=tz),
        id="linkedin_monitoring", name="Weekly LinkedIn Page Monitor",
        replace_existing=True, misfire_grace_time=GRACE_PERIOD,
    )

    # Weekly competitor profile extraction — Mondays 3:30pm IST
    scheduler.add_job(
        _run_profile_extraction,
        CronTrigger(day_of_week="mon", hour=15, minute=30, timezone=tz),
        id="profile_extraction",
        name="Weekly Competitor Profile Extraction",
        replace_existing=True,
        misfire_grace_time=GRACE_PERIOD,
    )

    # Weekly source performance rollup — Sundays 9pm IST
    scheduler.add_job(
        _run_source_performance_rollup,
        CronTrigger(day_of_week="sun", hour=21, minute=0, timezone=tz),
        id="source_performance_rollup",
        name="Weekly Source Performance Rollup",
        replace_existing=True,
        misfire_grace_time=GRACE_PERIOD,
    )

    return scheduler
