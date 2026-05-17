"""
Competitor changelog: rolling log of feature/pricing/narrative changes.
Posted as a Slack thread, updated in place each week.
"""

import json
from datetime import datetime
from outputs.slack_client import post_message, section_block, divider_block, context_block, severity_emoji
from config.settings import settings
from db import database
from utils.logger import get_logger

logger = get_logger(__name__)


def post_changelog_update(changes: list[dict]) -> bool:
    """Post a changelog update to Slack with all recent changes."""
    if not changes:
        return False

    channel = settings.slack_channel_ci
    if not channel:
        return False

    from config.competitors import COMPETITORS

    # Group by competitor
    grouped: dict[str, list[dict]] = {}
    for change in changes:
        cid = change["competitor_id"]
        grouped.setdefault(cid, []).append(change)

    blocks = []
    week = datetime.now().strftime("Week of %B %d, %Y")
    blocks.append({
        "type": "header",
        "text": {"type": "plain_text", "text": f"Competitor Changelog — {week}"},
    })

    for competitor_id, comp_changes in sorted(grouped.items()):
        competitor_name = COMPETITORS.get(competitor_id, {}).get("name", competitor_id)
        change_lines = []
        for c in comp_changes:
            emoji = severity_emoji(c["severity"])
            change_type = c["change_type"].replace("_", " ").title()
            summary = c.get("diff_summary", "Change detected")
            change_lines.append(f"{emoji} *{change_type}*: {summary}")

        blocks.append(section_block(f"*{competitor_name}*\n" + "\n".join(change_lines)))
        blocks.append(divider_block())

    blocks.append(context_block(f"Total changes: {len(changes)} | Generated {datetime.now().strftime('%Y-%m-%d %H:%M IST')}"))

    ts = post_message(
        channel=channel,
        text=f"Competitor Changelog — {week}",
        blocks=blocks,
    )

    if ts:
        from utils.diff_engine import compute_hash
        database.track_output_sent(
            output_type="changelog",
            slack_channel=channel,
            message_ts=ts,
            content_hash=compute_hash(json.dumps(changes, sort_keys=True)),
        )
        return True

    return False
