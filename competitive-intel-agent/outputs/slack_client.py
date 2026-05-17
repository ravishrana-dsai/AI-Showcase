from __future__ import annotations
"""
Slack client using Block Kit for rich formatted messages.
Handles posting, updating, and threading Slack messages.
"""

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

_client: WebClient | None = None


def get_slack_client() -> WebClient:
    global _client
    if _client is None:
        if not settings.slack_bot_token:
            raise ValueError("SLACK_BOT_TOKEN not set in .env")
        _client = WebClient(token=settings.slack_bot_token)
    return _client


def post_message(
    channel: str,
    text: str,
    blocks: list[dict] | None = None,
    thread_ts: str | None = None,
) -> str | None:
    """
    Post a message to a Slack channel.
    Returns message timestamp (ts) or None on failure.
    """
    if not channel:
        logger.warning("Slack channel not configured, skipping post", text_preview=text[:60])
        return None

    try:
        client = get_slack_client()
        kwargs = {"channel": channel, "text": text}
        if blocks:
            kwargs["blocks"] = blocks
        if thread_ts:
            kwargs["thread_ts"] = thread_ts

        response = client.chat_postMessage(**kwargs)
        ts = response["ts"]
        logger.info("Slack message posted", channel=channel, ts=ts)
        return ts
    except SlackApiError as e:
        logger.error("Slack post failed", channel=channel, error=str(e))
        return None


def update_message(channel: str, ts: str, text: str, blocks: list[dict] | None = None) -> bool:
    """Update an existing Slack message. Returns True on success."""
    try:
        client = get_slack_client()
        kwargs = {"channel": channel, "ts": ts, "text": text}
        if blocks:
            kwargs["blocks"] = blocks
        client.chat_update(**kwargs)
        logger.info("Slack message updated", channel=channel, ts=ts)
        return True
    except SlackApiError as e:
        logger.error("Slack update failed", ts=ts, error=str(e))
        return False


def post_test_message() -> bool:
    """Post a test message to the admin channel. Returns True on success."""
    channel = settings.slack_channel_admin or settings.slack_channel_ci
    if not channel:
        print("No Slack channel configured. Set SLACK_CHANNEL_CI or SLACK_CHANNEL_ADMIN in .env")
        return False

    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "[Company] CI Bot — Test Message"},
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "CI bot is live and connected to Slack.\nAll systems operational.",
            },
        },
        {"type": "divider"},
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": "Tracking 25+ competitors across Padel and Pickleball analytics."}
            ],
        },
    ]

    ts = post_message(channel=channel, text="[Company] CI Bot — Test Message", blocks=blocks)
    return ts is not None


# ----------------------------------------------------------------
# Block Kit builder helpers
# ----------------------------------------------------------------

def header_block(text: str) -> dict:
    return {"type": "header", "text": {"type": "plain_text", "text": text[:150]}}


def section_block(text: str) -> dict:
    return {"type": "section", "text": {"type": "mrkdwn", "text": text[:3000]}}


def divider_block() -> dict:
    return {"type": "divider"}


def context_block(text: str) -> dict:
    return {"type": "context", "elements": [{"type": "mrkdwn", "text": text[:3000]}]}


def bullet_list(items: list[str], max_items: int = 10) -> str:
    """Format a list of strings as a Slack mrkdwn bullet list."""
    visible = items[:max_items]
    result = "\n".join(f"• {item}" for item in visible)
    if len(items) > max_items:
        result += f"\n_...and {len(items) - max_items} more_"
    return result


def severity_emoji(severity: str) -> str:
    return {
        "critical": ":rotating_light:",
        "high": ":warning:",
        "medium": ":large_yellow_circle:",
        "low": ":white_circle:",
    }.get(severity, ":white_circle:")
