from __future__ import annotations
"""
Weekly source performance rollup.
Aggregates signal quality, eval scores, and user feedback per collector/source.
Runs every Sunday at 9pm IST via the scheduler.
"""

from datetime import date, timedelta
from db import database
from utils.logger import get_logger

logger = get_logger(__name__)

# Map signal_type to collector_type display name
_SIGNAL_TO_COLLECTOR = {
    "news": "News Feeds",
    "job_posting": "Job Postings",
    "app_review": "App Reviews",
    "pricing": "Pricing Pages",
    "web_page": "Web Scraper",
    "social": "Social Signals",
    "trend": "Trend Research",
    "patent": "Patent Filings",
}

# Map signal_type to processor_type (for LLM cost join)
_SIGNAL_TO_PROCESSOR = {
    "news": "news",
    "job_posting": "hiring",
    "app_review": "sentiment",
    "pricing": "pricing",
    "web_page": "feature_gap",
    "social": "social_mentions",
    "trend": "trend",
    "patent": None,
}


def _last_sunday() -> str:
    today = date.today()
    days_since_sunday = (today.weekday() + 1) % 7
    return (today - timedelta(days=days_since_sunday)).isoformat()


def compute_weekly_rollup(week_start: str) -> list[dict]:
    """
    Compute source_performance rows for the given week_start (ISO date of Sunday).
    Returns list of row dicts that were upserted.
    """
    week_end = (date.fromisoformat(week_start) + timedelta(days=7)).isoformat()
    rows_written: list[dict] = []

    with database.get_db() as conn:
        # Get distinct signal types active this week
        signal_types = conn.execute(
            """SELECT DISTINCT signal_type FROM raw_signals
               WHERE collected_at >= ? AND collected_at < ?""",
            (week_start, week_end),
        ).fetchall()

        for (signal_type,) in signal_types:
            collector_type = _SIGNAL_TO_COLLECTOR.get(signal_type, signal_type)
            processor_type = _SIGNAL_TO_PROCESSOR.get(signal_type)

            # Signal counts
            stats = conn.execute(
                """SELECT
                     COUNT(*) as total,
                     SUM(CASE WHEN quality_score IS NOT NULL THEN 1 ELSE 0 END) as scored,
                     AVG(quality_score) as avg_quality,
                     SUM(CASE WHEN quality_score >= 0.6 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as high_quality_pct
                   FROM raw_signals
                   WHERE signal_type=? AND collected_at >= ? AND collected_at < ?""",
                (signal_type, week_start, week_end),
            ).fetchone()

            total = stats["total"] or 0
            scored = stats["scored"] or 0
            avg_quality = round(stats["avg_quality"] or 0.0, 4)
            high_quality_pct = round(stats["high_quality_pct"] or 0.0, 2)

            # Average eval score from processed intelligence (for this signal type's processor)
            avg_eval = None
            if processor_type:
                eval_row = conn.execute(
                    """SELECT AVG(pi.confidence_score)
                       FROM processed_intelligence pi
                       WHERE pi.processor_type=?
                         AND pi.created_at >= ? AND pi.created_at < ?
                         AND pi.confidence_score IS NOT NULL""",
                    (processor_type, week_start, week_end),
                ).fetchone()
                if eval_row and eval_row[0] is not None:
                    avg_eval = round(eval_row[0], 2)

            # User feedback (positive %)
            user_positive_pct = None
            feedback_row = conn.execute(
                """SELECT
                     COUNT(*) as total_fb,
                     SUM(CASE WHEN f.feedback=1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as positive_pct
                   FROM intelligence_feedback f
                   JOIN processed_intelligence pi ON pi.id = f.intelligence_id
                   WHERE pi.processor_type=?
                     AND f.created_at >= ? AND f.created_at < ?""",
                (processor_type or "", week_start, week_end),
            ).fetchone()
            if feedback_row and feedback_row["total_fb"] > 0:
                user_positive_pct = round(feedback_row["positive_pct"] or 0.0, 2)

            # LLM cost for this signal type's processor
            llm_cost = 0.0
            if processor_type:
                cost_row = conn.execute(
                    """SELECT SUM(cost_usd) FROM llm_usage
                       WHERE processor_type=? AND called_at >= ? AND called_at < ?""",
                    (processor_type, week_start, week_end),
                ).fetchone()
                if cost_row and cost_row[0] is not None:
                    llm_cost = round(cost_row[0], 6)

            # Calculate bias from user feedback
            neg_rate_row = conn.execute(
                """SELECT
                   COUNT(CASE WHEN f.feedback = -1 THEN 1 END) * 1.0 / NULLIF(COUNT(f.id), 0)
                   FROM intelligence_feedback f
                   JOIN processed_intelligence pi ON pi.id = f.intelligence_id
                   WHERE pi.processor_type = ?
                   AND f.created_at >= date('now', '-28 days')""",
                (signal_type,),
            ).fetchone()
            neg_rate = (neg_rate_row[0] or 0.0) if neg_rate_row else 0.0
            bias_adjustment = -0.15 if neg_rate > 0.30 else 0.0

            row = {
                "collector_type": collector_type,
                "signal_type": signal_type,
                "week_start": week_start,
                "total_signals": total,
                "scored_signals": scored,
                "avg_quality_score": avg_quality,
                "high_quality_pct": high_quality_pct,
                "avg_eval_score": avg_eval,
                "user_positive_pct": user_positive_pct,
                "llm_cost_usd": llm_cost,
                "bias_adjustment": bias_adjustment,
            }
            database.upsert_source_performance(row)
            rows_written.append(row)
            logger.info("Source performance upserted", **{k: v for k, v in row.items() if k not in ("week_start",)})

    return rows_written


def get_signal_funnel() -> dict:
    """Return overall signal funnel counts (all time)."""
    with database.get_db() as conn:
        collected = conn.execute("SELECT COUNT(*) FROM raw_signals").fetchone()[0]
        quality_filtered = conn.execute(
            "SELECT COUNT(*) FROM raw_signals WHERE quality_score IS NOT NULL AND quality_score < 0.4"
        ).fetchone()[0]
        processed = conn.execute(
            "SELECT COUNT(*) FROM raw_signals WHERE processed=1"
        ).fetchone()[0]
        eval_scored = conn.execute(
            "SELECT COUNT(*) FROM processed_intelligence WHERE confidence_score IS NOT NULL"
        ).fetchone()[0]
        # "useful" = eval score >= 7 OR user gave thumbs up
        useful = conn.execute(
            """SELECT COUNT(DISTINCT pi.id)
               FROM processed_intelligence pi
               WHERE pi.confidence_score >= 7
                  OR EXISTS (
                      SELECT 1 FROM intelligence_feedback f
                      WHERE f.intelligence_id=pi.id AND f.feedback=1
                  )"""
        ).fetchone()[0]

    return {
        "collected": collected,
        "quality_filtered": quality_filtered,
        "processed": processed,
        "eval_scored": eval_scored,
        "useful": useful,
    }


def get_health_panel_data() -> dict:
    """Return data for the Eval tab System Health panel."""
    perf_rows = database.get_source_performance(weeks=4)
    funnel = get_signal_funnel()

    # Sort for top/bottom
    scored_rows = [r for r in perf_rows if r.get("avg_eval_score") is not None]
    top_sources = sorted(scored_rows, key=lambda r: r.get("avg_eval_score") or 0, reverse=True)[:3]
    bottom_sources = sorted(scored_rows, key=lambda r: r.get("avg_eval_score") or 0)[:3]

    # Overall waste rate: signals scored below threshold / total scored
    with database.get_db() as conn:
        total_scored = conn.execute(
            "SELECT COUNT(*) FROM raw_signals WHERE quality_score IS NOT NULL"
        ).fetchone()[0]
        low_quality = conn.execute(
            "SELECT COUNT(*) FROM raw_signals WHERE quality_score IS NOT NULL AND quality_score < 0.4"
        ).fetchone()[0]

    waste_rate = round((low_quality / total_scored * 100) if total_scored > 0 else 0, 1)

    # Recent eval scores for the right-column card list
    with database.get_db() as conn:
        recent_intel = conn.execute(
            """SELECT id, competitor_id, processor_type, confidence_score, eval_notes, created_at
               FROM processed_intelligence
               ORDER BY created_at DESC LIMIT 20"""
        ).fetchall()
        recent = []
        for r in recent_intel:
            import json as _json
            notes = {}
            try:
                notes = _json.loads(r["eval_notes"] or "{}")
            except Exception:
                pass
            recent.append({
                "id": r["id"],
                "competitor_id": r["competitor_id"],
                "processor_type": r["processor_type"],
                "confidence_score": r["confidence_score"],
                "reasoning": notes.get("reasoning", ""),
                "top_weakness": notes.get("top_weakness", ""),
                "created_at": r["created_at"],
            })

    return {
        "top_sources": top_sources,
        "bottom_sources": bottom_sources,
        "waste_rate": waste_rate,
        "funnel": funnel,
        "all_sources": perf_rows,
        "recent_intel": recent,
        "last_rollup": perf_rows[0].get("computed_at") if perf_rows else None,
    }


def run_weekly_rollup() -> None:
    """Scheduler entry point. Runs Sunday 9pm IST."""
    week_start = _last_sunday()
    logger.info("Starting weekly source performance rollup", week_start=week_start)
    rows = compute_weekly_rollup(week_start)
    logger.info("Rollup complete", rows_written=len(rows))

    # Check for underperforming sources and send Slack alert
    health = get_health_panel_data()
    _maybe_send_slack_alert(health)


def _maybe_send_slack_alert(health: dict) -> None:
    """Send Slack notification if any source is consistently underperforming."""
    try:
        from config.settings import settings
        if not getattr(settings, "slack_webhook_url", None):
            return

        bad_sources = [
            s for s in health.get("all_sources", [])
            if s.get("avg_eval_score") is not None and s["avg_eval_score"] < 4.0
        ]
        if not bad_sources:
            return

        lines = ["*System Health Alert* - Underperforming sources detected:"]
        for s in bad_sources[:3]:
            lines.append(
                f"  - {s['collector_type']}: avg eval score {s['avg_eval_score']:.1f}/10 "
                f"(quality {s['avg_quality_score']:.2f}, {s['total_signals']} signals)"
            )
        lines.append(f"Waste rate: {health['waste_rate']}% of scored signals filtered pre-LLM")

        import urllib.request
        import json as _json
        payload = {"text": "\n".join(lines)}
        req = urllib.request.Request(
            settings.slack_webhook_url,
            data=_json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=10)
        logger.info("Slack health alert sent", bad_sources=len(bad_sources))
    except Exception as exc:
        logger.debug("Slack health alert failed (non-fatal)", error=str(exc))
