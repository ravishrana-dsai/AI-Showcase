"""
Weekly CI brief: assembles and posts the full competitive intelligence summary to Slack.
"""

import json
from datetime import datetime
from outputs.slack_client import (
    post_message, header_block, section_block, divider_block,
    context_block, bullet_list, severity_emoji
)
from config.settings import settings
from db import database
from utils.logger import get_logger

logger = get_logger(__name__)


def _gather_week_intel() -> dict:
    """Gather latest processed intelligence for all competitors."""
    from config.competitors import get_active_competitors, COMPETITORS
    competitors = get_active_competitors()

    intel = {
        "changes": [],
        "top_news": [],
        "feature_gaps": [],
        "pricing_changes": [],
        "hiring_signals": [],
        "sentiment_trends": [],
    }

    # Recent changes
    all_changes = database.get_unalerted_changes()
    intel["changes"] = all_changes

    # Latest news digest summaries
    for competitor_id in list(competitors.keys())[:15]:
        news = database.get_latest_intelligence(competitor_id, "news_digest")
        if news:
            try:
                data = json.loads(news["analysis_json"])
                if data.get("top_insight"):
                    intel["top_news"].append({
                        "competitor": COMPETITORS.get(competitor_id, {}).get("name", competitor_id),
                        "insight": data["top_insight"],
                    })
            except Exception:
                pass

        feature = database.get_latest_intelligence(competitor_id, "feature_gap")
        if feature:
            try:
                data = json.loads(feature["analysis_json"])
                threat = data.get("threat_level", "low")
                if threat in ("high", "critical"):
                    intel["feature_gaps"].append({
                        "competitor": COMPETITORS.get(competitor_id, {}).get("name", competitor_id),
                        "threat_level": threat,
                        "summary": data.get("summary", ""),
                    })
            except Exception:
                pass

        hiring = database.get_latest_intelligence(competitor_id, "hiring_signals")
        if hiring:
            try:
                data = json.loads(hiring["analysis_json"])
                inferences = data.get("roadmap_inferences", [])
                high_conf = [i for i in inferences if i.get("confidence") == "high"]
                if high_conf:
                    intel["hiring_signals"].append({
                        "competitor": COMPETITORS.get(competitor_id, {}).get("name", competitor_id),
                        "signals": [i["inference"] for i in high_conf[:3]],
                    })
            except Exception:
                pass

        sentiment = database.get_latest_intelligence(competitor_id, "review_sentiment")
        if sentiment:
            try:
                data = json.loads(sentiment["analysis_json"])
                if data.get("sentiment_trend") == "declining":
                    intel["sentiment_trends"].append({
                        "competitor": COMPETITORS.get(competitor_id, {}).get("name", competitor_id),
                        "trend": "declining",
                        "pain_points": [p["theme"] for p in data.get("pain_points", [])[:3]],
                    })
            except Exception:
                pass

    return intel


def _build_brief_blocks(intel: dict) -> list[dict]:
    week = datetime.now().strftime("Week of %B %d, %Y")
    blocks = [
        header_block(f"[Company] CI Brief — {week}"),
    ]

    # Headline changes
    changes = intel.get("changes", [])
    critical_high = [c for c in changes if c.get("severity") in ("critical", "high")]
    if critical_high:
        change_lines = []
        from config.competitors import COMPETITORS
        for c in critical_high[:5]:
            emoji = severity_emoji(c["severity"])
            name = COMPETITORS.get(c["competitor_id"], {}).get("name", c["competitor_id"])
            change_lines.append(f"{emoji} *{name}*: {c.get('diff_summary', 'Change detected')}")
        blocks.append(section_block("*HEADLINE CHANGES THIS WEEK*\n" + "\n".join(change_lines)))
        blocks.append(divider_block())
    else:
        blocks.append(section_block("*HEADLINE CHANGES*\nNo critical or high-severity changes this week."))
        blocks.append(divider_block())

    # Top news insights
    top_news = intel.get("top_news", [])
    if top_news:
        news_lines = [f"• *{n['competitor']}*: {n['insight']}" for n in top_news[:6]]
        blocks.append(section_block("*TOP INTELLIGENCE*\n" + "\n".join(news_lines)))
        blocks.append(divider_block())

    # Feature gap threats
    feature_gaps = intel.get("feature_gaps", [])
    if feature_gaps:
        gap_lines = [f"• *{f['competitor']}* ({f['threat_level'].upper()}): {f['summary'][:100]}" for f in feature_gaps[:4]]
        blocks.append(section_block("*FEATURE THREAT SIGNALS*\n" + "\n".join(gap_lines)))
        blocks.append(divider_block())

    # Hiring roadmap signals
    hiring_signals = intel.get("hiring_signals", [])
    if hiring_signals:
        hire_lines = []
        for h in hiring_signals[:4]:
            sigs = "; ".join(h["signals"])
            hire_lines.append(f"• *{h['competitor']}*: {sigs}")
        blocks.append(section_block("*ROADMAP SIGNALS (from hiring)*\n" + "\n".join(hire_lines)))
        blocks.append(divider_block())

    # Competitor sentiment
    sentiment_trends = intel.get("sentiment_trends", [])
    if sentiment_trends:
        sent_lines = []
        for s in sentiment_trends[:4]:
            pp = ", ".join(s["pain_points"])
            sent_lines.append(f"• *{s['competitor']}* sentiment declining — Pain points: {pp}")
        blocks.append(section_block("*COMPETITOR WEAKNESSES (user sentiment)*\n" + "\n".join(sent_lines)))
        blocks.append(divider_block())

    total_changes = len(changes)
    blocks.append(context_block(
        f"Tracking 25+ competitors | {total_changes} total changes this week | "
        f"Generated {datetime.now().strftime('%Y-%m-%d %H:%M IST')}"
    ))

    return blocks


def post_weekly_brief() -> bool:
    """Assemble and post the weekly CI brief to Slack."""
    logger.info("Generating weekly CI brief")
    intel = _gather_week_intel()
    blocks = _build_brief_blocks(intel)

    channel = settings.slack_channel_ci
    if not channel:
        logger.warning("Slack CI channel not configured")
        return False

    week = datetime.now().strftime("Week of %B %d, %Y")
    ts = post_message(
        channel=channel,
        text=f"[Company] CI Brief — {week}",
        blocks=blocks,
    )

    if ts:
        from utils.diff_engine import compute_hash
        database.track_output_sent(
            output_type="weekly_brief",
            slack_channel=channel,
            message_ts=ts,
            content_hash=compute_hash(json.dumps(intel, sort_keys=True)),
        )

        # Also post the changelog for this week's changes
        if intel.get("changes"):
            from outputs.changelog import post_changelog_update
            post_changelog_update(intel["changes"])
            # Mark all changes as alerted
            change_ids = [c["id"] for c in intel["changes"]]
            database.mark_changes_alerted(change_ids)

        logger.info("Weekly brief posted", channel=channel, ts=ts)
        return True

    return False
