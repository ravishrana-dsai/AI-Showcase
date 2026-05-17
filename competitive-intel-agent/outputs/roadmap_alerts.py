"""
Roadmap alerts: immediate Slack notifications for critical/high severity changes.
"""

import json
from datetime import datetime
from outputs.slack_client import (
    post_message, header_block, section_block, divider_block, context_block,
    severity_emoji
)
from config.settings import settings
from db import database
from utils.logger import get_logger

logger = get_logger(__name__)


def _format_alert_blocks(change: dict, competitor_name: str) -> list[dict]:
    emoji = severity_emoji(change["severity"])
    severity_label = change["severity"].upper()

    blocks = [
        header_block(f"{emoji} {severity_label} CHANGE — {competitor_name}"),
        section_block(
            f"*Type:* {change['change_type'].replace('_', ' ').title()}\n"
            f"*Detected:* {change['detected_at']}\n\n"
            f"*Summary:* {change.get('diff_summary', 'No details available.')}"
        ),
        divider_block(),
        context_block(f"Competitor: {change['competitor_id']} | Change ID: {change['id']}"),
    ]
    return blocks


def send_pending_alerts() -> int:
    """
    Check for unalerted high/critical changes and send Slack alerts.
    Returns count of alerts sent.
    """
    changes = database.get_unalerted_changes(severity_min="high")
    if not changes:
        logger.info("No pending high/critical alerts")
        return 0

    channel = settings.slack_channel_alerts or settings.slack_channel_ci
    sent_ids = []

    for change in changes:
        competitor_id = change["competitor_id"]

        # Get competitor name for display
        from config.competitors import COMPETITORS
        competitor_name = COMPETITORS.get(competitor_id, {}).get("name", competitor_id)

        blocks = _format_alert_blocks(change, competitor_name)
        ts = post_message(
            channel=channel,
            text=f"{severity_emoji(change['severity'])} {change['severity'].upper()} change detected for {competitor_name}",
            blocks=blocks,
        )

        if ts:
            sent_ids.append(change["id"])
            database.track_output_sent(
                output_type="alert",
                slack_channel=channel,
                message_ts=ts,
                content_hash=change["current_hash"],
            )

    if sent_ids:
        database.mark_changes_alerted(sent_ids)
        logger.info("Alerts sent", count=len(sent_ids))

    return len(sent_ids)
